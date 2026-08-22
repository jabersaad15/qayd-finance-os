import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, gt, inArray, isNull, lte, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { accounts, approvalRequests, appRoles, branches as branchTable, companies, executiveApprovalActions, executiveApprovalPolicies, executiveDecisions, executiveInboxItems, executiveOpportunities, executiveRisks, invoices, journalEntries, journalLines, operationalIssues, operationalTasks, payments, salesOpportunities, supplierInvoices, tenantUsers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";

const ceoRoles = ["general_manager", "super_admin"] as const;
const dateRangeInput = z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), period: z.enum(["today", "current_month", "previous_month", "quarter", "year", "custom"]).default("current_month"), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const scopeInput = z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() });
const approvalActions = ["approve", "reject", "request_information"] as const;

function rangeFor(input: z.infer<typeof dateRangeInput>) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (input.period === "custom") {
    if (!input.from || !input.to || input.to < input.from) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد فترة مخصصة صحيحة." });
    return { from: input.from, to: input.to };
  }
  const y = today.getUTCFullYear(); const m = today.getUTCMonth();
  if (input.period === "today") return { from: iso(today), to: iso(today) };
  if (input.period === "previous_month") return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
  if (input.period === "quarter") { const startMonth = Math.floor(m / 3) * 3; return { from: iso(new Date(Date.UTC(y, startMonth, 1))), to: iso(new Date(Date.UTC(y, startMonth + 3, 0))) }; }
  if (input.period === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
}

async function requireCeo(userId: number, input: { tenantId: number; companyId: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [actor] = await db.select({ role: appRoles }).from(tenantUsers).leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!actor || !ceoRoles.includes((actor.role?.code ?? "read_only") as typeof ceoRoles[number])) throw new TRPCError({ code: "FORBIDDEN", message: "مركز القيادة التنفيذي متاح للمدير التنفيذي أو المدير العام المخول فقط." });
  return { db, roleCode: actor.role?.code ?? "read_only" };
}

const money = (value: unknown) => Number(value ?? 0);
const sumExpr = (column: any) => sql<string>`COALESCE(SUM(${column}), 0)`;

export const ceoRouter = router({
  dashboard: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireCeo(ctx.user.id, input);
    const range = rangeFor(input);
    const issuedInvoiceStatuses = ["approved", "zatca_processing", "cleared", "reported", "sent", "partially_paid", "paid", "overdue"] as const;
    const activeOpportunityStages = ["new_lead", "qualified", "discovery", "proposal", "negotiation", "on_hold"] as const;
    const [invoiceTotals, paymentTotals, supplierTotals, pipelineTotals, journalProfit, approvals, tasks, issues, risks, opportunities, inbox, decisions, branches] = await Promise.all([
      db.select({ revenue: sumExpr(invoices.grandTotal), receivables: sumExpr(sql`(${invoices.grandTotal} - ${invoices.paidTotal})`) }).from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), inArray(invoices.status, issuedInvoiceStatuses), gte(invoices.issueDate, new Date(`${range.from}T00:00:00.000Z`)), lte(invoices.issueDate, new Date(`${range.to}T23:59:59.999Z`)))),
      db.select({ inflow: sumExpr(payments.amount) }).from(payments).where(and(eq(payments.tenantId, input.tenantId), eq(payments.companyId, input.companyId), eq(payments.direction, "receipt"), eq(payments.status, "posted"), gte(payments.paymentDate, new Date(`${range.from}T00:00:00.000Z`)), lte(payments.paymentDate, new Date(`${range.to}T23:59:59.999Z`)))),
      db.select({ payables: sumExpr(supplierInvoices.grandTotal), expenses: sumExpr(supplierInvoices.subtotal) }).from(supplierInvoices).where(and(eq(supplierInvoices.tenantId, input.tenantId), eq(supplierInvoices.companyId, input.companyId), inArray(supplierInvoices.status, ["approved", "posted"]), gte(supplierInvoices.invoiceDate, new Date(`${range.from}T00:00:00.000Z`)), lte(supplierInvoices.invoiceDate, new Date(`${range.to}T23:59:59.999Z`)))),
      db.select({ pipeline: sumExpr(salesOpportunities.expectedValue), count: sql<number>`COUNT(*)` }).from(salesOpportunities).where(and(eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId), inArray(salesOpportunities.stage, activeOpportunityStages))),
      db.select({ accountType: accounts.accountType, debit: sumExpr(journalLines.debit), credit: sumExpr(journalLines.credit) }).from(journalLines).innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id)).innerJoin(accounts, eq(journalLines.accountId, accounts.id)).where(and(eq(journalLines.tenantId, input.tenantId), eq(journalEntries.companyId, input.companyId), eq(journalEntries.status, "posted"), gte(journalEntries.entryDate, new Date(`${range.from}T00:00:00.000Z`)), lte(journalEntries.entryDate, new Date(`${range.to}T23:59:59.999Z`)))).groupBy(accounts.accountType),
      db.select({ approval: approvalRequests, requester: users }).from(approvalRequests).innerJoin(users, eq(approvalRequests.requestedByUserId, users.id)).where(and(eq(approvalRequests.tenantId, input.tenantId), eq(approvalRequests.companyId, input.companyId), eq(approvalRequests.status, "pending"))).orderBy(desc(approvalRequests.amount), asc(approvalRequests.requestedAt)).limit(50),
      db.select({ open: sql<number>`COUNT(*)`, overdue: sql<number>`SUM(CASE WHEN ${operationalTasks.dueAt} < NOW() THEN 1 ELSE 0 END)` }).from(operationalTasks).where(and(eq(operationalTasks.tenantId, input.tenantId), eq(operationalTasks.companyId, input.companyId), inArray(operationalTasks.status, ["new", "assigned", "in_progress", "waiting", "blocked", "escalated"]))),
      db.select({ open: sql<number>`COUNT(*)`, critical: sql<number>`SUM(CASE WHEN ${operationalIssues.severity} = 'critical' THEN 1 ELSE 0 END)` }).from(operationalIssues).where(and(eq(operationalIssues.tenantId, input.tenantId), eq(operationalIssues.companyId, input.companyId), inArray(operationalIssues.status, ["new", "assigned", "investigation", "action_required"]))),
      db.select().from(executiveRisks).where(and(eq(executiveRisks.tenantId, input.tenantId), eq(executiveRisks.companyId, input.companyId), inArray(executiveRisks.status, ["open", "mitigating"]))).orderBy(desc(executiveRisks.severity), asc(executiveRisks.dueDate)).limit(20),
      db.select().from(executiveOpportunities).where(and(eq(executiveOpportunities.tenantId, input.tenantId), eq(executiveOpportunities.companyId, input.companyId), inArray(executiveOpportunities.status, ["open", "mitigating"]))).orderBy(desc(executiveOpportunities.estimatedValue)).limit(20),
      db.select().from(executiveInboxItems).where(and(eq(executiveInboxItems.tenantId, input.tenantId), eq(executiveInboxItems.companyId, input.companyId), eq(executiveInboxItems.status, "open"))).orderBy(desc(executiveInboxItems.priority), asc(executiveInboxItems.dueAt)).limit(30),
      db.select().from(executiveDecisions).where(and(eq(executiveDecisions.tenantId, input.tenantId), eq(executiveDecisions.companyId, input.companyId), inArray(executiveDecisions.status, ["issued", "assigned", "in_progress", "waiting"]))).orderBy(asc(executiveDecisions.dueDate)).limit(20),
      db.select({ id: branchTable.id, code: branchTable.code, nameAr: branchTable.nameAr, sales: sumExpr(invoices.grandTotal), invoicesCount: sql<number>`COUNT(${invoices.id})` }).from(branchTable).leftJoin(invoices, and(eq(invoices.branchId, branchTable.id), inArray(invoices.status, issuedInvoiceStatuses), gte(invoices.issueDate, new Date(`${range.from}T00:00:00.000Z`)), lte(invoices.issueDate, new Date(`${range.to}T23:59:59.999Z`)))).where(and(eq(branchTable.tenantId, input.tenantId), eq(branchTable.companyId, input.companyId), eq(branchTable.isActive, true))).groupBy(branchTable.id, branchTable.code, branchTable.nameAr).orderBy(desc(sql`COALESCE(SUM(${invoices.grandTotal}),0)`)),
    ]);
    const revenue = money(invoiceTotals[0]?.revenue); const receivables = money(invoiceTotals[0]?.receivables); const payables = money(supplierTotals[0]?.payables); const expenses = money(supplierTotals[0]?.expenses); const cashInflow = money(paymentTotals[0]?.inflow);
    const profitByType = Object.fromEntries(journalProfit.map((row) => [row.accountType, money(row.credit) - money(row.debit)]));
    const netProfit = (profitByType.revenue ?? 0) + (profitByType.other_income ?? 0) - (profitByType.cost_of_revenue ?? 0) - (profitByType.expense ?? 0) - (profitByType.other_expense ?? 0);
    const criticalApproval = approvals.filter(({ approval }) => money(approval.amount) > 0).slice(0, 10);
    return { roleCode, period: range, metrics: { revenue, netProfit, cashPosition: cashInflow, receivables, payables, expenses, pipelineValue: money(pipelineTotals[0]?.pipeline), pipelineCount: Number(pipelineTotals[0]?.count ?? 0), operationalPerformance: tasks[0]?.open ? Math.max(0, 100 - (Number(tasks[0]?.overdue ?? 0) / Math.max(1, Number(tasks[0]?.open ?? 0))) * 100) : null, overdueTasks: Number(tasks[0]?.overdue ?? 0), openTasks: Number(tasks[0]?.open ?? 0), openIssues: Number(issues[0]?.open ?? 0), criticalIssues: Number(issues[0]?.critical ?? 0), collectionRate: revenue > 0 ? Math.min(100, (cashInflow / revenue) * 100) : null }, departments: { sales: { revenue, pipeline: money(pipelineTotals[0]?.pipeline), opportunities: Number(pipelineTotals[0]?.count ?? 0) }, finance: { revenue, netProfit, cash: cashInflow, receivables, payables, expenses }, operations: { openIssues: Number(issues[0]?.open ?? 0), criticalIssues: Number(issues[0]?.critical ?? 0), overdueTasks: Number(tasks[0]?.overdue ?? 0) }, administration: { inboxItems: inbox.length, openDecisions: decisions.length } }, approvals: criticalApproval, risks, opportunities, inbox, decisions, branches, traceability: { revenue: "invoices.grandTotal ضمن الفواتير المعتمدة/المسجلة للفترة", cashPosition: "payments.amount للمدفوعات المرحّلة للفترة", netProfit: journalProfit.length ? "journalEntries المرحّلة + journalLines + accounts حسب نوع الحساب" : "لا توجد قيود مرحلة للفترة", pipelineValue: "salesOpportunities.expectedValue للمراحل النشطة" } };
  }),

  decideApproval: protectedProcedure.input(scopeInput.extend({ approvalRequestId: z.number().int().positive(), action: z.enum(approvalActions), note: z.string().trim().max(5000).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireCeo(ctx.user.id, input);
    const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.approvalRequestId), eq(approvalRequests.tenantId, input.tenantId), eq(approvalRequests.companyId, input.companyId), eq(approvalRequests.status, "pending"))).limit(1);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الاعتماد غير موجود أو تمت معالجته." });
    if (request.requestedByUserId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن اعتماد طلب أنشأته أنت." });
    const nextStatus = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "pending";
    await db.update(approvalRequests).set({ status: nextStatus, decidedByUserId: ctx.user.id, decisionNote: input.note || null, decidedAt: input.action === "request_information" ? null : new Date() }).where(eq(approvalRequests.id, request.id));
    await db.insert(executiveApprovalActions).values({ tenantId: input.tenantId, companyId: input.companyId, approvalRequestId: request.id, action: input.action, note: input.note || null, actorUserId: ctx.user.id });
    return { updated: true, status: nextStatus } as const;
  }),

  approvalPolicies: protectedProcedure.input(scopeInput).query(async ({ ctx, input }) => { const { db } = await requireCeo(ctx.user.id, input); return db.select().from(executiveApprovalPolicies).where(and(eq(executiveApprovalPolicies.tenantId, input.tenantId), eq(executiveApprovalPolicies.companyId, input.companyId), eq(executiveApprovalPolicies.active, true))).orderBy(asc(executiveApprovalPolicies.documentType), asc(executiveApprovalPolicies.minAmount)); }),

  aiAnalysis: protectedProcedure.input(dateRangeInput).mutation(async ({ ctx, input }) => {
    const { db } = await requireCeo(ctx.user.id, input);
    const range = rangeFor(input);
    const [revenue, pipeline, openIssues, pendingApprovals] = await Promise.all([
      db.select({ total: sumExpr(invoices.grandTotal), paid: sumExpr(invoices.paidTotal) }).from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), inArray(invoices.status, ["approved", "zatca_processing", "cleared", "reported", "sent", "partially_paid", "paid", "overdue"]), gte(invoices.issueDate, new Date(`${range.from}T00:00:00.000Z`)), lte(invoices.issueDate, new Date(`${range.to}T23:59:59.999Z`)))),
      db.select({ total: sumExpr(salesOpportunities.expectedValue), count: sql<number>`COUNT(*)` }).from(salesOpportunities).where(and(eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId), inArray(salesOpportunities.stage, ["new_lead", "qualified", "discovery", "proposal", "negotiation", "on_hold"]))),
      db.select({ total: sql<number>`COUNT(*)` }).from(operationalIssues).where(and(eq(operationalIssues.tenantId, input.tenantId), eq(operationalIssues.companyId, input.companyId), inArray(operationalIssues.status, ["new", "assigned", "investigation", "action_required"]))),
      db.select({ total: sql<number>`COUNT(*)` }).from(approvalRequests).where(and(eq(approvalRequests.tenantId, input.tenantId), eq(approvalRequests.companyId, input.companyId), eq(approvalRequests.status, "pending"))),
    ]);
    const safeSnapshot = { period: range, revenue: money(revenue[0]?.total), collected: money(revenue[0]?.paid), pipelineValue: money(pipeline[0]?.total), pipelineCount: Number(pipeline[0]?.count ?? 0), openIssues: Number(openIssues[0]?.total ?? 0), pendingApprovals: Number(pendingApprovals[0]?.total ?? 0) };
    const response = await invokeLLM({ model: "gpt-5-mini", reasoning: { effort: "low" }, maxTokens: 1200, messages: [{ role: "system", content: "أنت محلل تنفيذي داخل قيد. حلل الأرقام المرفقة فقط. لا تخترع أرقاماً أو وقائع أو أسباباً غير موجودة. إذا لم تكف البيانات، صرّح بذلك بوضوح. أعد JSON فقط بالعربية." }, { role: "user", content: JSON.stringify(safeSnapshot) }], responseFormat: { type: "json_schema", json_schema: { name: "ceo_analysis", strict: true, schema: { type: "object", properties: { summary: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] }, insights: { type: "array", items: { type: "object", properties: { title: { type: "string" }, evidence: { type: "string" }, action: { type: "string" } }, required: ["title", "evidence", "action"], additionalProperties: false } }, limitations: { type: "array", items: { type: "string" } } }, required: ["summary", "confidence", "insights", "limitations"], additionalProperties: false } } } });
    const content = response.choices[0]?.message.content;
    const text = typeof content === "string" ? content : JSON.stringify(content);
    try { return { snapshot: safeSnapshot, analysis: JSON.parse(text) as { summary: string; confidence: string; insights: Array<{ title: string; evidence: string; action: string }>; limitations: string[] } }; } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة التحليل التنفيذي المنظم." }); }
  }),
  saveApprovalPolicy: protectedProcedure.input(scopeInput.extend({ documentType: z.string().trim().min(2).max(64), roleCode: z.string().trim().min(2).max(64), minAmount: z.number().nonnegative(), maxAmount: z.number().positive().optional(), requiresCeo: z.boolean().default(false) })).mutation(async ({ ctx, input }) => { const { db, roleCode } = await requireCeo(ctx.user.id, input); if (roleCode !== "company_admin" && roleCode !== "super_admin") throw new TRPCError({ code: "FORBIDDEN", message: "تعديل مصفوفة الاعتماد متاح لمدير الشركة أو مدير المنصة فقط." }); const result = await db.insert(executiveApprovalPolicies).values({ tenantId: input.tenantId, companyId: input.companyId, documentType: input.documentType, roleCode: input.roleCode, minAmount: input.minAmount.toFixed(6), maxAmount: input.maxAmount?.toFixed(6) ?? null, requiresCeo: input.requiresCeo, createdByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { maxAmount: input.maxAmount?.toFixed(6) ?? null, requiresCeo: input.requiresCeo, active: true } }); return { id: Number(result[0].insertId) }; }),

  listRisks: protectedProcedure.input(scopeInput).query(async ({ ctx, input }) => { const { db } = await requireCeo(ctx.user.id, input); return db.select().from(executiveRisks).where(and(eq(executiveRisks.tenantId, input.tenantId), eq(executiveRisks.companyId, input.companyId), inArray(executiveRisks.status, ["open", "mitigating"]))).orderBy(desc(executiveRisks.severity), asc(executiveRisks.dueDate)); }),
  listOpportunities: protectedProcedure.input(scopeInput).query(async ({ ctx, input }) => { const { db } = await requireCeo(ctx.user.id, input); return db.select().from(executiveOpportunities).where(and(eq(executiveOpportunities.tenantId, input.tenantId), eq(executiveOpportunities.companyId, input.companyId), inArray(executiveOpportunities.status, ["open", "mitigating"]))).orderBy(desc(executiveOpportunities.estimatedValue)); }),
});

export type CeoRouter = typeof ceoRouter;
