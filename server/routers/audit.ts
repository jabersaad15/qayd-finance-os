import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appRoles, auditClosingNotes, auditEngagements, auditFinalReports, auditIndependenceDeclarations, auditLogs, auditReopenRequests, auditSignOffs, fiscalPeriods, journalEntries, tenantUsers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { appendAuditLog } from "../finance/auditLog";
import { protectedProcedure, router } from "../_core/trpc";
import { canActivateAuditEngagement, canApproveAuditReopen, canFinalizeAuditReport, canModifyAuditFinalReport, nextIndependenceDeclarationStatus } from "../../shared/auditControls";

const auditActorCodes = ["external_auditor", "cfo", "super_admin"] as const;
const privilegedCodes = ["cfo", "super_admin"] as const;
const opinionStatus = z.enum(["draft", "final", "qualified", "disclaimer", "adverse"]);

async function requireAuditActor(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [member] = await db.select({ roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member || !member.roleCode || !auditActorCodes.includes(member.roleCode as (typeof auditActorCodes)[number])) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم دور مراجع قانوني أو مدير مالي مخول للوصول إلى وحدة المراجعة." });
  return { db, roleCode: member.roleCode };
}

async function requireEngagement(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, engagementId: number, tenantId: number, companyId: number, userId: number, roleCode: string, allowPendingIndependence = false) {
  const [engagement] = await db.select().from(auditEngagements).where(and(eq(auditEngagements.id, engagementId), eq(auditEngagements.tenantId, tenantId), eq(auditEngagements.companyId, companyId))).limit(1);
  if (!engagement) throw new TRPCError({ code: "NOT_FOUND", message: "ارتباط المراجعة غير موجود ضمن الشركة." });
  if (roleCode === "external_auditor" && engagement.auditorUserId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "ارتباط المراجعة لا يتبع المراجع الحالي." });
  if (roleCode === "external_auditor" && ((!allowPendingIndependence && engagement.status !== "active") || new Date(engagement.accessExpiry).getTime() < Date.now())) throw new TRPCError({ code: "FORBIDDEN", message: "وصول المراجع لهذا الارتباط غير نشط أو منتهي." });
  return engagement;
}

export const auditRouter = router({
  dashboard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    const engagementQuery = and(eq(auditEngagements.tenantId, input.tenantId), eq(auditEngagements.companyId, input.companyId), ...(roleCode === "external_auditor" ? [eq(auditEngagements.auditorUserId, ctx.user.id)] : []));
    const engagements = await db.select().from(auditEngagements).where(engagementQuery).orderBy(desc(auditEngagements.createdAt));
    const engagementIds = engagements.map((item) => item.id);
    const [periods, closeHistory, entries, notes, requests, reports, signoffs, declarations] = await Promise.all([
      db.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId))).orderBy(desc(fiscalPeriods.endDate)),
      db.select({ id: auditLogs.id, action: auditLogs.action, entityId: auditLogs.entityId, actorUserId: auditLogs.actorUserId, createdAt: auditLogs.createdAt, previousValue: auditLogs.previousValue, newValue: auditLogs.newValue, actorName: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).where(and(eq(auditLogs.tenantId, input.tenantId), eq(auditLogs.companyId, input.companyId), eq(auditLogs.entityType, "fiscal_period"))).orderBy(desc(auditLogs.createdAt)),
      db.select({ id: journalEntries.id, fiscalPeriodId: journalEntries.fiscalPeriodId, entryNumber: journalEntries.entryNumber, entryDate: journalEntries.entryDate, createdAt: journalEntries.createdAt, postedAt: journalEntries.postedAt, status: journalEntries.status, description: journalEntries.description }).from(journalEntries).where(and(eq(journalEntries.tenantId, input.tenantId), eq(journalEntries.companyId, input.companyId))).orderBy(desc(journalEntries.createdAt)),
      engagementIds.length ? db.select().from(auditClosingNotes).where(inArray(auditClosingNotes.engagementId, engagementIds)).orderBy(desc(auditClosingNotes.createdAt)) : Promise.resolve([]),
      engagementIds.length ? db.select().from(auditReopenRequests).where(inArray(auditReopenRequests.engagementId, engagementIds)).orderBy(desc(auditReopenRequests.createdAt)) : Promise.resolve([]),
      engagementIds.length ? db.select().from(auditFinalReports).where(inArray(auditFinalReports.engagementId, engagementIds)).orderBy(desc(auditFinalReports.updatedAt)) : Promise.resolve([]),
      engagementIds.length ? db.select().from(auditSignOffs).where(inArray(auditSignOffs.reportId, (await db.select({ id: auditFinalReports.id }).from(auditFinalReports).where(inArray(auditFinalReports.engagementId, engagementIds))).map((item) => item.id))) : Promise.resolve([]),
      engagementIds.length ? db.select().from(auditIndependenceDeclarations).where(inArray(auditIndependenceDeclarations.engagementId, engagementIds)).orderBy(desc(auditIndependenceDeclarations.declaredAt)) : Promise.resolve([]),
    ]);
    return { roleCode, engagements, periods, closeHistory, entries, notes, requests, reports, signoffs, declarations };
  }),

  createEngagement: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), fiscalPeriodId: z.number().int().positive(), engagementName: z.string().min(3).max(255), auditFirm: z.string().max(255).optional(), accessStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), accessExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    if (input.accessStart > input.accessExpiry) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ انتهاء الوصول يجب أن يأتي بعد بدايته." });
    const [period] = await db.select({ id: fiscalPeriods.id }).from(fiscalPeriods).where(and(eq(fiscalPeriods.id, input.fiscalPeriodId), eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId))).limit(1);
    if (!period) throw new TRPCError({ code: "NOT_FOUND", message: "الفترة المالية غير موجودة ضمن الشركة." });
    const result = await db.insert(auditEngagements).values({ ...input, auditorUserId: ctx.user.id, createdByUserId: ctx.user.id, accessStart: new Date(input.accessStart), accessExpiry: new Date(input.accessExpiry), status: "pending_independence", isIndependenceDeclared: false });
    const id = Number(result[0].insertId);
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "audit.engagement.created", entityType: "audit_engagement", entityId: id, newValue: { fiscalPeriodId: input.fiscalPeriodId, accessStart: input.accessStart, accessExpiry: input.accessExpiry } });
    return { id };
  }),

  declareIndependence: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), engagementId: z.number().int().positive(), auditFirm: z.string().max(255).optional(), independenceConfirmed: z.boolean(), hasPotentialConflict: z.boolean(), potentialRelationships: z.string().max(3000).optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    await requireEngagement(db, input.engagementId, input.tenantId, input.companyId, ctx.user.id, roleCode, true);
    if (!input.independenceConfirmed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم الإقرار بالاستقلالية لتسجيل بداية ارتباط المراجعة." });
    const existing = await db.select({ id: auditIndependenceDeclarations.id }).from(auditIndependenceDeclarations).where(eq(auditIndependenceDeclarations.engagementId, input.engagementId)).limit(1);
    const declarationStatus = nextIndependenceDeclarationStatus(Boolean(existing[0]), input.hasPotentialConflict);
    const result = await db.insert(auditIndependenceDeclarations).values({ tenantId: input.tenantId, engagementId: input.engagementId, auditorUserId: ctx.user.id, auditFirm: input.auditFirm, independenceConfirmed: true, hasPotentialConflict: input.hasPotentialConflict, potentialRelationships: input.potentialRelationships, declarationStatus, declaredAt: new Date() });
    const id = Number(result[0].insertId);
    if (!canActivateAuditEngagement(true)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم إقرار الاستقلالية لتفعيل ارتباط المراجعة." });
    await db.update(auditEngagements).set({ status: "active", isIndependenceDeclared: true }).where(eq(auditEngagements.id, input.engagementId));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "audit.independence.declared", entityType: "audit_independence", entityId: id, newValue: { engagementId: input.engagementId, hasPotentialConflict: input.hasPotentialConflict } });
    return { id };
  }),

  addClosingNote: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), engagementId: z.number().int().positive(), fiscalPeriodId: z.number().int().positive(), note: z.string().min(3).max(5000) })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    const engagement = await requireEngagement(db, input.engagementId, input.tenantId, input.companyId, ctx.user.id, roleCode);
    if (engagement.fiscalPeriodId !== input.fiscalPeriodId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "تختلف فترة الملاحظة عن نطاق ارتباط المراجعة." });
    const result = await db.insert(auditClosingNotes).values({ tenantId: input.tenantId, companyId: input.companyId, engagementId: input.engagementId, fiscalPeriodId: input.fiscalPeriodId, authorUserId: ctx.user.id, note: input.note });
    const id = Number(result[0].insertId);
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "audit.closing_note.created", entityType: "audit_closing_note", entityId: id, newValue: { fiscalPeriodId: input.fiscalPeriodId } });
    return { id };
  }),

  requestReopen: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), engagementId: z.number().int().positive(), fiscalPeriodId: z.number().int().positive(), reason: z.string().min(5).max(5000) })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    const engagement = await requireEngagement(db, input.engagementId, input.tenantId, input.companyId, ctx.user.id, roleCode);
    if (engagement.fiscalPeriodId !== input.fiscalPeriodId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الطلب يجب أن يكون ضمن فترة ارتباط المراجعة." });
    const [period] = await db.select({ id: fiscalPeriods.id, status: fiscalPeriods.status }).from(fiscalPeriods).where(and(eq(fiscalPeriods.id, input.fiscalPeriodId), eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId))).limit(1);
    if (!period || period.status === "open") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يلزم طلب إعادة فتح لفترة مفتوحة أو غير موجودة." });
    const result = await db.insert(auditReopenRequests).values({ tenantId: input.tenantId, companyId: input.companyId, engagementId: input.engagementId, fiscalPeriodId: input.fiscalPeriodId, requestedByUserId: ctx.user.id, reason: input.reason, status: "pending" });
    const id = Number(result[0].insertId);
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "audit.reopen.requested", entityType: "audit_reopen_request", entityId: id, reason: input.reason, newValue: { fiscalPeriodId: input.fiscalPeriodId } });
    return { id };
  }),

  reviewReopenRequest: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), requestId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), decisionNote: z.string().max(3000).optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    if (!canApproveAuditReopen(roleCode)) throw new TRPCError({ code: "FORBIDDEN", message: "اعتماد طلب إعادة الفتح مخصص للمدير المالي أو المسؤول المخول." });
    const [request] = await db.select().from(auditReopenRequests).where(and(eq(auditReopenRequests.id, input.requestId), eq(auditReopenRequests.tenantId, input.tenantId), eq(auditReopenRequests.companyId, input.companyId), eq(auditReopenRequests.status, "pending"))).limit(1);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "طلب إعادة الفتح المعلق غير موجود." });
    await db.update(auditReopenRequests).set({ status: input.decision, reviewedByUserId: ctx.user.id, reviewedAt: new Date(), decisionNote: input.decisionNote }).where(eq(auditReopenRequests.id, request.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: `audit.reopen.${input.decision}`, entityType: "audit_reopen_request", entityId: request.id, reason: input.decisionNote });
    return { reviewed: true };
  }),

  saveFinalReportDraft: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), engagementId: z.number().int().positive(), summaryOfFindings: z.string().max(10000).optional(), materialMisstatements: z.string().max(10000).optional(), adjustmentsProposed: z.string().max(10000).optional(), adjustmentsAcceptedRejected: z.string().max(10000).optional(), complianceStatus: z.string().max(5000).optional(), vatReviewSummary: z.string().max(5000).optional(), zakatReviewSummary: z.string().max(5000).optional(), financialStatementOpinionDraft: z.string().max(5000).optional(), managementResponses: z.string().max(10000).optional(), opinionStatus })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    const engagement = await requireEngagement(db, input.engagementId, input.tenantId, input.companyId, ctx.user.id, roleCode);
    const [existing] = await db.select().from(auditFinalReports).where(eq(auditFinalReports.engagementId, input.engagementId)).limit(1);
    if (existing && !canModifyAuditFinalReport(existing.isLocked)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "التقرير مقفل بعد الإقفال النهائي ولا يمكن تعديله." });
    const values = { summaryOfFindings: input.summaryOfFindings, materialMisstatements: input.materialMisstatements, adjustmentsProposed: input.adjustmentsProposed, adjustmentsAcceptedRejected: input.adjustmentsAcceptedRejected, complianceStatus: input.complianceStatus, vatReviewSummary: input.vatReviewSummary, zakatReviewSummary: input.zakatReviewSummary, financialStatementOpinionDraft: input.financialStatementOpinionDraft, managementResponses: input.managementResponses, opinionStatus: input.opinionStatus };
    const reportId = existing ? existing.id : Number((await db.insert(auditFinalReports).values({ tenantId: input.tenantId, companyId: input.companyId, engagementId: input.engagementId, fiscalPeriodId: engagement.fiscalPeriodId, createdByUserId: ctx.user.id, ...values }))[0].insertId);
    if (existing) await db.update(auditFinalReports).set(values).where(eq(auditFinalReports.id, existing.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "audit.final_report.saved", entityType: "audit_final_report", entityId: reportId, newValue: { engagementId: input.engagementId, opinionStatus: input.opinionStatus } });
    return { id: reportId };
  }),

  signOffFinalReport: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), reportId: z.number().int().positive(), auditorName: z.string().min(2).max(255), professionalLicenseNumber: z.string().min(2).max(128), auditFirm: z.string().min(2).max(255), auditScope: z.string().min(10).max(10000), opinionStatus })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    const [report] = await db.select().from(auditFinalReports).where(and(eq(auditFinalReports.id, input.reportId), eq(auditFinalReports.tenantId, input.tenantId), eq(auditFinalReports.companyId, input.companyId))).limit(1);
    if (!report || report.isLocked) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "التقرير غير متاح للتوقيع أو أنه مقفل." });
    const engagement = await requireEngagement(db, report.engagementId, input.tenantId, input.companyId, ctx.user.id, roleCode);
    const [signed] = await db.select({ id: auditSignOffs.id }).from(auditSignOffs).where(eq(auditSignOffs.reportId, report.id)).limit(1);
    if (signed) throw new TRPCError({ code: "CONFLICT", message: "يوجد توقيع رقمي مسجل لهذا التقرير." });
    const result = await db.insert(auditSignOffs).values({ tenantId: input.tenantId, reportId: report.id, fiscalPeriodId: engagement.fiscalPeriodId, auditorUserId: ctx.user.id, auditorName: input.auditorName, professionalLicenseNumber: input.professionalLicenseNumber, auditFirm: input.auditFirm, auditScope: input.auditScope, opinionStatus: input.opinionStatus, signedAt: new Date() });
    const id = Number(result[0].insertId);
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "audit.final_report.signed", entityType: "audit_signoff", entityId: id, newValue: { reportId: report.id, opinionStatus: input.opinionStatus } });
    return { id };
  }),

  finalizeReport: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), reportId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireAuditActor(ctx.user.id, input.tenantId, input.companyId);
    const [report] = await db.select().from(auditFinalReports).where(and(eq(auditFinalReports.id, input.reportId), eq(auditFinalReports.tenantId, input.tenantId), eq(auditFinalReports.companyId, input.companyId))).limit(1);
    if (!report || !canModifyAuditFinalReport(report.isLocked)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "التقرير غير متاح للإقفال النهائي." });
    await requireEngagement(db, report.engagementId, input.tenantId, input.companyId, ctx.user.id, roleCode);
    const [signOff] = await db.select().from(auditSignOffs).where(eq(auditSignOffs.reportId, report.id)).limit(1);
    if (!canFinalizeAuditReport(report.isLocked, Boolean(signOff))) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن اعتماد التقرير النهائي دون توقيع المراجع الرقمي." });
    await db.update(auditFinalReports).set({ isLocked: true, lockedAt: new Date(), opinionStatus: signOff.opinionStatus }).where(eq(auditFinalReports.id, report.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "audit.final_report.locked", entityType: "audit_final_report", entityId: report.id, newValue: { signOffId: signOff.id, opinionStatus: signOff.opinionStatus } });
    return { finalized: true };
  }),
});
