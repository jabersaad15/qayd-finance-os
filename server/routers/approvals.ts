import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appRoles, approvalPolicies, approvalRequests, approvalCases, approvalCaseSteps, approvalCaseActions, approvalCaseAttachments, centralApprovalPolicies, approvalDelegations, tenantUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { appendAuditLog } from "../finance/auditLog";
import { approvalCaseNotification, createInternalNotification } from "../finance/internalNotifications";
import { financeAdministrationRoles } from "../finance/roleAccess";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

export const centralApprovalRequestTypes = {
  sales: ["quotation_approval", "discount_approval", "exceptional_pricing", "large_deal_approval"],
  finance: ["journal_entry_approval", "expense_approval", "payment_approval", "credit_note_approval", "debit_note_approval", "write_off_approval", "period_reopen_approval"],
  operations: ["operational_request", "high_priority_request", "exception_request", "major_corrective_action"],
  administration: ["administrative_request", "document_approval", "correspondence_approval"],
  executive: ["high_value_request", "strategic_exception", "major_contract", "final_approval"],
} as const;

async function requireMember(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [member] = await db.select({ id: tenantUsers.id, roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.userId, userId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية الوصول إلى الموافقات." });
  return { db, roleCode: member.roleCode };
}

export const approvalsRouter = router({
  listPolicies: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentType: z.string().max(64).optional() })).query(async ({ ctx, input }) => {
    const { db } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    return db.select().from(approvalPolicies).where(and(eq(approvalPolicies.tenantId, input.tenantId), eq(approvalPolicies.companyId, input.companyId), eq(approvalPolicies.isActive, true), input.documentType ? eq(approvalPolicies.documentType, input.documentType) : undefined));
  }),

  createRequest: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentType: z.string().min(2).max(64), documentId: z.number().int().positive(), amount: z.string().regex(/^\d+(\.\d{1,6})?$/).default("0.000000"), reason: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    const [existing] = await db.select({ id: approvalRequests.id }).from(approvalRequests).where(and(eq(approvalRequests.tenantId, input.tenantId), eq(approvalRequests.companyId, input.companyId), eq(approvalRequests.documentType, input.documentType), eq(approvalRequests.documentId, input.documentId), eq(approvalRequests.status, "pending"))).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "يوجد طلب موافقة مفتوح لهذا المستند." });
    const [inserted] = await db.insert(approvalRequests).values({ tenantId: input.tenantId, companyId: input.companyId, documentType: input.documentType, documentId: input.documentId, requestedByUserId: ctx.user.id, amount: input.amount, reason: input.reason });
    const requestId = Number(inserted.insertId);
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "approval.requested", entityType: "approval_request", entityId: requestId, newValue: input });
    return { requestId, status: "pending" as const };
  }),

  listPending: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentType: z.string().max(64).optional() })).query(async ({ ctx, input }) => {
    const { db } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    return db.select().from(approvalRequests).where(and(eq(approvalRequests.tenantId, input.tenantId), eq(approvalRequests.companyId, input.companyId), eq(approvalRequests.status, "pending"), input.documentType ? eq(approvalRequests.documentType, input.documentType) : undefined)).orderBy(desc(approvalRequests.requestedAt));
  }),

  decide: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), requestId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), note: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    if (!roleCode || !financeAdministrationRoles.includes(roleCode as typeof financeAdministrationRoles[number])) throw new TRPCError({ code: "FORBIDDEN", message: "اعتماد العمليات محصور بالمدير المالي ورئيس الحسابات أو الإدارة المخولة." });
    const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.tenantId, input.tenantId), eq(approvalRequests.companyId, input.companyId))).limit(1);
    if (!request || request.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "طلب الموافقة غير متاح أو تمت معالجته." });
    if (request.requestedByUserId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن لصاحب الطلب اعتماد طلبه بنفسه." });
    await db.update(approvalRequests).set({ status: input.decision, decidedByUserId: ctx.user.id, decisionNote: input.note, decidedAt: new Date() }).where(eq(approvalRequests.id, request.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: `approval.${input.decision}`, entityType: "approval_request", entityId: request.id, previousValue: { status: request.status }, newValue: { status: input.decision, note: input.note } });
    return { requestId: request.id, status: input.decision };
  }),

  centralList: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), tab: z.enum(["pending", "mine", "approved", "rejected", "returned", "completed"]).default("pending"), inboxFilter: z.enum(["all", "new", "due_today", "overdue", "high_value", "critical"]).default("all") })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    const [cases, steps, actions] = await Promise.all([
      db.select().from(approvalCases).where(and(eq(approvalCases.tenantId, input.tenantId), eq(approvalCases.companyId, input.companyId))).orderBy(desc(approvalCases.createdAt)),
      db.select().from(approvalCaseSteps),
      db.select().from(approvalCaseActions),
    ]);
    const attachments = cases.length ? await db.select().from(approvalCaseAttachments).where(inArray(approvalCaseAttachments.caseId, cases.map((item) => item.id))).orderBy(desc(approvalCaseAttachments.createdAt)) : [];
    const scopedSteps = steps.filter((step) => step.roleCode === roleCode || step.assignedUserId === ctx.user.id);
    const visible = cases.filter((item) => {
      const now = Date.now();
      const dueTime = item.dueAt?.getTime();
      const inboxMatches = input.inboxFilter === "all" || (input.inboxFilter === "new" && now - item.createdAt.getTime() <= 24 * 3600000) || (input.inboxFilter === "due_today" && !!dueTime && dueTime >= now && dueTime <= now + 24 * 3600000) || (input.inboxFilter === "overdue" && !!dueTime && dueTime < now) || (input.inboxFilter === "high_value" && Number(item.amount) >= 50000) || (input.inboxFilter === "critical" && (item.riskLevel === "critical" || item.priority === "urgent"));
      if (!inboxMatches) return false;
      if (input.tab === "mine") return item.requestedByUserId === ctx.user.id;
      if (input.tab === "pending") return item.status === "pending" && scopedSteps.some((step) => step.caseId === item.id && step.status === "pending");
      const permitted = item.requestedByUserId === ctx.user.id || scopedSteps.some((step) => step.caseId === item.id);
      if (input.tab === "approved") return permitted && item.status === "approved";
      if (input.tab === "rejected") return permitted && item.status === "rejected";
      if (input.tab === "returned") return permitted && (item.status === "returned" || item.status === "information_required");
      return permitted && item.status === "completed";
    });
    return visible.map((item) => ({ ...item, steps: steps.filter((step) => step.caseId === item.id), actions: actions.filter((action) => action.caseId === item.id), attachments: attachments.filter((attachment) => attachment.caseId === item.id) }));
  }),

  centralCreate: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), requestType: z.string().min(2).max(96), module: z.string().min(2).max(64), entityType: z.string().min(2).max(96), entityId: z.number().int().positive().optional(), department: z.string().max(128).optional(), branchId: z.number().int().positive().optional(), amount: z.string().regex(/^\d+(\.\d{1,6})?$/).default("0"), currency: z.string().length(3).default("SAR"), reason: z.string().min(3).max(4000), priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"), deadline: z.string().date().optional(), dueAt: z.coerce.date().optional(), riskLevel: z.string().max(32).optional(), workflowMode: z.enum(["sequential", "parallel"]).default("sequential"), quorum: z.enum(["any_one", "all"]).default("all"), metadata: z.record(z.string(), z.unknown()).optional(), steps: z.array(z.object({ stageKey: z.string().min(2).max(64), roleCode: z.string().max(64).optional(), assignedUserId: z.number().int().positive().optional(), requiredApprovals: z.number().int().positive().default(1) })).min(1).max(12) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    const requestNumber = `AC-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const [inserted] = await db.insert(approvalCases).values({ tenantId: input.tenantId, companyId: input.companyId, requestType: input.requestType, module: input.module, entityType: input.entityType, entityId: input.entityId, requestNumber, requestedByUserId: ctx.user.id, department: input.department, branchId: input.branchId, amount: input.amount, currency: input.currency, reason: input.reason, priority: input.priority, riskLevel: input.riskLevel, workflowMode: input.workflowMode, quorum: input.quorum, deadline: input.deadline ? new Date(`${input.deadline}T00:00:00Z`) : undefined, dueAt: input.dueAt, metadata: input.metadata });
    const caseId = Number(inserted.insertId);
    await db.insert(approvalCaseSteps).values(input.steps.map((step, index) => ({ caseId, sequence: index + 1, stageKey: step.stageKey, roleCode: step.roleCode, assignedUserId: step.assignedUserId, requiredApprovals: step.requiredApprovals })));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "central_approval.requested", entityType: "approval_case", entityId: caseId, newValue: { requestNumber, requestType: input.requestType, amount: input.amount } });
    await createInternalNotification(db, approvalCaseNotification({ tenantId: input.tenantId, companyId: input.companyId, caseId, requestNumber, eventType: "approval.created" }));
    return { caseId, requestNumber, status: "pending" as const };
  }),

  centralUploadAttachment: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), caseId: z.number().int().positive(), fileName: z.string().min(1).max(255).refine((value) => !/[\\/\\u0000-\\u001f\\u007f]/.test(value), "اسم الملف غير صالح."), mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]), fileSize: z.number().int().positive().max(10 * 1024 * 1024), dataBase64: z.string().min(16).max(14 * 1024 * 1024) })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    const [item] = await db.select().from(approvalCases).where(and(eq(approvalCases.id, input.caseId), eq(approvalCases.tenantId, input.tenantId), eq(approvalCases.companyId, input.companyId))).limit(1);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الموافقة غير موجود ضمن الشركة الحالية." });
    const caseSteps = await db.select().from(approvalCaseSteps).where(eq(approvalCaseSteps.caseId, item.id));
    const canAttach = item.requestedByUserId === ctx.user.id || caseSteps.some((step) => step.assignedUserId === ctx.user.id || step.roleCode === roleCode);
    if (!canAttach) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إرفاق ملف بهذا الطلب." });
    const buffer = Buffer.from(input.dataBase64, "base64");
    if (buffer.length !== input.fileSize) throw new TRPCError({ code: "BAD_REQUEST", message: "حجم الملف المرسل لا يطابق البيانات المعلنة." });
    const stored = await storagePut(`approval-attachments/${input.tenantId}/${input.companyId}/${input.caseId}/${randomUUID()}-${input.fileName}`, buffer, input.mimeType);
    const [created] = await db.insert(approvalCaseAttachments).values({ caseId: input.caseId, tenantId: input.tenantId, companyId: input.companyId, uploadedByUserId: ctx.user.id, fileName: input.fileName, mimeType: input.mimeType, fileKey: stored.key, fileUrl: stored.url, fileSize: input.fileSize });
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "central_approval.attachment_uploaded", entityType: "approval_case", entityId: input.caseId, newValue: { fileName: input.fileName, mimeType: input.mimeType, fileSize: input.fileSize } });
    return { attachmentId: Number(created.insertId), url: stored.url };
  }),

  centralAct: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), caseId: z.number().int().positive(), action: z.enum(["approve", "reject", "return", "request_information"]), note: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    if (input.action === "reject" && !input.note?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "سبب الرفض إلزامي." });
    const [item] = await db.select().from(approvalCases).where(and(eq(approvalCases.id, input.caseId), eq(approvalCases.tenantId, input.tenantId), eq(approvalCases.companyId, input.companyId))).limit(1);
    if (!item || item.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "طلب الموافقة غير متاح أو تمت معالجته." });
    if (item.requestedByUserId === ctx.user.id && input.action === "approve") throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن لصاحب الطلب اعتماد طلبه بنفسه." });
    const steps = await db.select().from(approvalCaseSteps).where(eq(approvalCaseSteps.caseId, item.id));
    const step = steps.find((candidate) => candidate.status === "pending" && (item.workflowMode === "parallel" || candidate.sequence === item.currentStep) && (candidate.assignedUserId === ctx.user.id || candidate.roleCode === roleCode));
    if (!step) throw new TRPCError({ code: "FORBIDDEN", message: "لا توجد مرحلة موافقة مسندة إلى دورك أو حسابك." });
    const nextStatus = input.action === "reject" ? "rejected" : input.action === "return" ? "returned" : input.action === "request_information" ? "information_required" : "approved";
    await db.insert(approvalCaseActions).values({ caseId: item.id, stepId: step.id, actorUserId: ctx.user.id, action: input.action, note: input.note });
    if (input.action === "approve") {
      const approvedCount = step.approvedCount + 1;
      const stepComplete = item.quorum === "any_one" || approvedCount >= step.requiredApprovals;
      await db.update(approvalCaseSteps).set({ approvedCount, status: stepComplete ? "approved" : "pending" }).where(eq(approvalCaseSteps.id, step.id));
      const remaining = steps.filter((candidate) => candidate.id !== step.id && candidate.status === "pending");
      const nextStep = item.workflowMode === "sequential" ? remaining.filter((candidate) => candidate.sequence > step.sequence).sort((a, b) => a.sequence - b.sequence)[0] : remaining[0];
      await db.update(approvalCases).set(stepComplete && !nextStep ? { status: "completed" } : stepComplete ? { currentStep: nextStep.sequence } : {}).where(eq(approvalCases.id, item.id));
    } else {
      await db.update(approvalCaseSteps).set({ status: nextStatus }).where(eq(approvalCaseSteps.id, step.id));
      await db.update(approvalCases).set({ status: nextStatus }).where(eq(approvalCases.id, item.id));
    }
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: `central_approval.${input.action}`, entityType: "approval_case", entityId: item.id, newValue: { stepId: step.id, note: input.note } });
    const eventType = input.action === "approve" ? "approval.approved" : input.action === "reject" ? "approval.rejected" : input.action === "return" ? "approval.returned" : "approval.information_required";
    await createInternalNotification(db, approvalCaseNotification({ tenantId: input.tenantId, companyId: input.companyId, caseId: item.id, recipientUserId: item.requestedByUserId === ctx.user.id ? undefined : item.requestedByUserId, requestNumber: item.requestNumber, eventType, note: input.note }));
    return { caseId: item.id, action: input.action };
  }),

  centralEscalateOverdue: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), caseId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    if (!financeAdministrationRoles.includes(roleCode as typeof financeAdministrationRoles[number])) throw new TRPCError({ code: "FORBIDDEN", message: "تصعيد الطلبات محصور بالإدارة المالية المخولة." });
    const [item] = await db.select().from(approvalCases).where(and(eq(approvalCases.id, input.caseId), eq(approvalCases.tenantId, input.tenantId), eq(approvalCases.companyId, input.companyId))).limit(1);
    if (!item || item.status !== "pending" || !item.dueAt || item.dueAt.getTime() > Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تصعيد طلب غير متأخر ضمن نطاق الشركة." });
    await db.update(approvalCases).set({ status: "escalated" }).where(eq(approvalCases.id, item.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "central_approval.escalated", entityType: "approval_case", entityId: item.id, previousValue: { status: item.status }, newValue: { status: "escalated" } });
    await createInternalNotification(db, approvalCaseNotification({ tenantId: input.tenantId, companyId: input.companyId, caseId: item.id, recipientUserId: item.requestedByUserId, requestNumber: item.requestNumber, eventType: "approval.information_required", note: "تم تصعيد الطلب بسبب تجاوز الموعد." }));
    return { caseId: item.id, status: "escalated" as const };
  }),

  centralPolicies: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    return db.select().from(centralApprovalPolicies).where(and(eq(centralApprovalPolicies.tenantId, input.tenantId), eq(centralApprovalPolicies.companyId, input.companyId), eq(centralApprovalPolicies.isActive, true)));
  }),

  centralSavePolicy: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), requestType: z.string().min(2).max(96), module: z.string().min(2).max(64), minAmount: z.string().regex(/^\d+(\.\d{1,6})?$/).default("0"), maxAmount: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(), department: z.string().max(128).optional(), branchId: z.number().int().positive().optional(), roleCode: z.string().max(64).optional(), riskLevel: z.string().max(32).optional(), workflowMode: z.enum(["sequential", "parallel"]).default("sequential"), quorum: z.enum(["any_one", "all"]).default("all"), steps: z.array(z.object({ stageKey: z.string().min(2), roleCode: z.string().max(64).optional() })).min(1), requiresStepUp: z.boolean().default(false), slaHours: z.number().int().positive().optional(), escalationAfterHours: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    if (!financeAdministrationRoles.includes((await requireMember(ctx.user.id, input.tenantId, input.companyId)).roleCode as typeof financeAdministrationRoles[number])) throw new TRPCError({ code: "FORBIDDEN", message: "تخصيص مصفوفة الموافقات محصور بالإدارة المالية المخولة." });
    const [inserted] = await db.insert(centralApprovalPolicies).values({ ...input, steps: input.steps });
    return { policyId: Number(inserted.insertId) };
  }),

  centralCreateDelegation: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), delegateeUserId: z.number().int().positive(), requestTypes: z.array(z.string().min(2).max(96)).min(1), maxAmount: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), reason: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireMember(ctx.user.id, input.tenantId, input.companyId);
    if (input.delegateeUserId === ctx.user.id || input.endsAt <= input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر مفوضاً آخر وحدد فترة زمنية صحيحة." });
    const [inserted] = await db.insert(approvalDelegations).values({ tenantId: input.tenantId, companyId: input.companyId, delegatorUserId: ctx.user.id, delegateeUserId: input.delegateeUserId, requestTypes: input.requestTypes, maxAmount: input.maxAmount, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason });
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "central_approval.delegated", entityType: "approval_delegation", entityId: Number(inserted.insertId), newValue: { delegateeUserId: input.delegateeUserId, startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString() } });
    return { delegationId: Number(inserted.insertId) };
  }),
});
