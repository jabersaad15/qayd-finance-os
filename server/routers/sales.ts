import { and, desc, eq, gte, inArray, isNotNull, like, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { accounts, appRoles, approvalRequests, companies, complianceChecks, complianceRulesets, customerContacts, customerContracts, customers, documentNumberingRules, documents, fiscalPeriods, invoiceLines, invoices, journalEntries, journalLines, outboxEvents, productsServices, quotationLines, quotations, salesActivities, salesCommissionEntries, salesCommissionRules, salesCustomerAttributions, salesOpportunities, salesOpportunityStageHistory, salesVisits, tenantUsers, users, zatcaSubmissions, auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { addMoney, calculateInvoiceTotals, preIssueStructuralCheck, subtractMoney } from "../finance/invariants";
import { appendAuditLog } from "../finance/auditLog";
import { protectedProcedure, router } from "../_core/trpc";
import { decimalMoneyPattern, isValidOnRequestPrice } from "../../shared/salesPricing";
import { defaultDocumentPrefix, formatDocumentNumber, reconcileNextDocumentNumber, type AutoDocumentType } from "../finance/documentNumbering";
import { canUseCompanyCapability, invoiceIssueRoles, salesCommissionAdminRoles, salesCrmRoles, salesQuotationRoles, salesReadRoles } from "../finance/roleAccess";
import { buildWhatsAppReminderUrl, sendPaymentReminderEmail } from "../finance/customerPaymentReminderEmail";
import { createInternalNotification } from "../finance/internalNotifications";
import { ensureDefaultChartOfAccounts } from "../finance/ensureChartOfAccounts";

const money = z.string().regex(decimalMoneyPattern);
export const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const customerAccountTier = z.enum(["standard", "large", "strategic"]);
const managementRoleCodes = ["company_admin", "super_admin", "finance_manager", "cfo", "general_manager"] as const;
export function isLargeAccountTier(accountTier: string) { return accountTier === "large" || accountTier === "strategic"; }

async function notifyManagementOfLargeAccountVisit(db: any, input: { tenantId: number; companyId: number; customerId: number; customerName: string; salesRepUserId: number; visitId: number; visitedAt: string; location?: string | null }) {
  const recipients = await db.select({ userId: tenantUsers.userId, roleCode: appRoles.code }).from(tenantUsers).innerJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"), or(...managementRoleCodes.map((code) => eq(appRoles.code, code)))));
  await Promise.all(recipients.filter((recipient: { userId: number }) => recipient.userId !== input.salesRepUserId).map((recipient: { userId: number }) => createInternalNotification(db, { tenantId: input.tenantId, companyId: input.companyId, recipientUserId: recipient.userId, eventType: "sales.large_account_visit.recorded", titleAr: "زيارة شركة كبرى جديدة", bodyAr: `سجل ممثل المبيعات زيارة جديدة للعميل ${input.customerName}${input.location ? ` في ${input.location}` : ""}. راجع تفاصيل الزيارة وسجل المتابعة من إدارة المبيعات.`, entityType: "sales_visit", entityId: input.visitId })));
}
const salesLine = z.object({ productServiceId: z.number().int().positive().optional(), description: z.string().min(1).max(500), quantity: money, unitPrice: money.refine(isValidOnRequestPrice, "حدد سعراً موجباً للخدمة عند إنشاء المستند."), discountAmount: money.default("0"), taxRateBps: z.number().int().min(0).max(10000) });
const contractInput = z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), salesRepUserId: z.number().int().positive().optional(), contractNumber: z.string().min(2).max(128), title: z.string().min(2).max(255), status: z.enum(["draft", "active", "expired", "terminated"]).default("draft"), startDate: z.string().regex(isoDatePattern).optional(), endDate: z.string().regex(isoDatePattern).optional(), contractValue: money.default("0"), documentId: z.number().int().positive().nullable().optional(), notes: z.string().max(4000).optional() });

type CustomerInvoiceForSummary = { id: number; invoiceNumber: string; status: string; issueDate: Date; dueDate: Date | null; grandTotal: string; paidTotal: string };

export function buildCustomerPaymentSummary(invoiceRows: CustomerInvoiceForSummary[], now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const payableRows = invoiceRows.filter((invoice) => !["draft", "pending_approval", "rejected", "credit_note_issued"].includes(invoice.status));
  const items = payableRows.map((invoice) => {
    const outstanding = subtractMoney(invoice.grandTotal, invoice.paidTotal);
    const dueAt = invoice.dueDate ? new Date(Date.UTC(invoice.dueDate.getUTCFullYear(), invoice.dueDate.getUTCMonth(), invoice.dueDate.getUTCDate())) : null;
    const daysFromDue = dueAt ? Math.round((dueAt.getTime() - today.getTime()) / 86_400_000) : null;
    const paymentStatus = outstanding === "0.000000" ? "paid" : daysFromDue !== null && daysFromDue < 0 ? "overdue" : daysFromDue !== null && daysFromDue <= 7 ? "upcoming" : "pending";
    const settlementStatus = outstanding === "0.000000" ? "paid" : invoice.paidTotal !== "0.000000" ? "partially_paid" : "unpaid";
    return { ...invoice, outstanding, paymentStatus, settlementStatus, daysFromDue };
  });
  return { totalInvoiced: addMoney(items.map((item) => item.grandTotal)), totalPaid: addMoney(items.map((item) => item.paidTotal)), remainingBalance: addMoney(items.map((item) => item.outstanding)), upcoming: items.filter((item) => item.paymentStatus === "upcoming"), overdue: items.filter((item) => item.paymentStatus === "overdue"), invoices: items };
}

async function accessCompany(userId: number, tenantId: number, companyId: number, allowedRoles?: readonly string[]) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const member = await db.select({ id: tenantUsers.id, roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member[0]) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك حق الوصول إلى هذه الشركة." });
  if (allowedRoles && !canUseCompanyCapability(member[0].roleCode, allowedRoles)) throw new TRPCError({ code: "FORBIDDEN", message: "دورك لا يملك صلاحية تنفيذ هذا الإجراء المالي." });
  return db;
}

async function accessSalesScope(userId: number, tenantId: number, companyId: number, allowedRoles: readonly string[] = salesQuotationRoles) {
  const db = await accessCompany(userId, tenantId, companyId, allowedRoles);
  const [member] = await db.select({ roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member?.roleCode) throw new TRPCError({ code: "FORBIDDEN", message: "تعذر تحديد دورك داخل قسم المبيعات." });
  return { db, roleCode: member.roleCode };
}

function scopedSalesOwner(roleCode: string, userId: number, ownerColumn: any) {
  return roleCode === "sales_rep" ? eq(ownerColumn, userId) : undefined;
}

async function accessOwnedSalesCustomer(db: any, roleCode: string, userId: number, input: { tenantId: number; companyId: number; customerId: number }) {
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId), eq(customers.isActive, true), scopedSalesOwner(roleCode, userId, customers.salesOwnerUserId))).limit(1);
  if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود ضمن نطاق صلاحيتك." });
  return customer;
}

function rejectFinancialSalesRole(roleCode: string) {
  if (["sales_rep", "sales"].includes(roleCode)) throw new TRPCError({ code: "FORBIDDEN", message: "مساحة المبيعات لا تتضمن التحصيلات أو بيانات الفواتير المالية." });
}

export function calculateSalesCommissionAmount(basisAmount: string | number, rateBps: number) {
  return (Number(basisAmount) * rateBps / 10000).toFixed(6);
}

export function validateCustomerIdentity(input: { customerType: "individual" | "company" | "government"; vatNumber?: string; unifiedNumber?: string }) {
  return input.customerType === "individual" || Boolean(input.vatNumber && /^\d{15}$/.test(input.vatNumber) && input.unifiedNumber && /^\d{10}$/.test(input.unifiedNumber));
}

async function ensureRuleset(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, tenantId: number) {
  const existing = await db.select().from(complianceRulesets).where(and(eq(complianceRulesets.tenantId, tenantId), eq(complianceRulesets.code, "ZATCA-STRUCTURAL"), eq(complianceRulesets.version, "foundation-1"))).limit(1);
  if (existing[0]) return existing[0].id;
  const result = await db.insert(complianceRulesets).values({ tenantId, code: "ZATCA-STRUCTURAL", version: "foundation-1", effectiveFrom: new Date("2026-01-01"), status: "active", sourceUrl: "https://zatca.gov.sa/en/E-Invoicing/Pages/default.aspx" });
  return Number(result[0].insertId);
}

async function reserveDocumentNumber(tx: any, input: { tenantId: number; companyId: number; type: AutoDocumentType; issueDate: Date }) {
  const [rule] = await tx.select().from(documentNumberingRules).where(and(eq(documentNumberingRules.tenantId, input.tenantId), eq(documentNumberingRules.companyId, input.companyId), eq(documentNumberingRules.documentType, input.type), eq(documentNumberingRules.isActive, true))).limit(1);
  const existingRows = input.type === "quotation"
    ? await tx.select({ number: quotations.quoteNumber }).from(quotations).where(and(eq(quotations.tenantId, input.tenantId), eq(quotations.companyId, input.companyId)))
    : await tx.select({ number: invoices.invoiceNumber }).from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId)));
  const prefix = rule?.prefix ?? defaultDocumentPrefix(input.type);
  const padding = rule?.padding ?? 3;
  const configuredNextNumber = rule?.nextNumber ?? 1;
  const nextNumber = reconcileNextDocumentNumber({ type: input.type, prefix, configuredNextNumber, padding, issueDate: input.issueDate, existingNumbers: existingRows.map((row: { number: string }) => row.number) });
  const number = formatDocumentNumber({ type: input.type, prefix, nextNumber, padding, issueDate: input.issueDate });
  if (!rule) {
    await tx.insert(documentNumberingRules).values({ tenantId: input.tenantId, companyId: input.companyId, documentType: input.type, prefix, nextNumber: nextNumber + 1, padding, isActive: true });
    return number;
  }
  const updateResult = await tx.update(documentNumberingRules).set({ nextNumber: nextNumber + 1 }).where(and(eq(documentNumberingRules.id, rule.id), eq(documentNumberingRules.nextNumber, rule.nextNumber)));
  if (Number(updateResult[0]?.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "تعذر حجز رقم مستند فريد؛ أعد المحاولة." });
  return number;
}

export const salesRouter = router({
  listServices: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    return db.select().from(productsServices).where(and(eq(productsServices.tenantId, input.tenantId), eq(productsServices.companyId, input.companyId), eq(productsServices.isActive, true)));
  }),

  listCustomers: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    return scope.db.select().from(customers).where(and(eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId), eq(customers.isActive, true), scopedSalesOwner(scope.roleCode, ctx.user.id, customers.salesOwnerUserId)));
  }),

  listSalesAssignees: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    const [actor] = await db.select({ roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, ctx.user.id), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))).limit(1);
    const members = await db.select({ userId: users.id, name: users.name, email: users.email, roleCode: appRoles.code, roleName: appRoles.nameAr }).from(tenantUsers).innerJoin(users, eq(users.id, tenantUsers.userId)).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active")));
    return members.filter((member) => (member.roleCode === "sales" || member.roleCode === "sales_rep") && (actor?.roleCode !== "sales_rep" || member.userId === ctx.user.id));

  }),

  recordCustomerAttribution: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), contactId: z.number().int().positive().optional(), salesRepUserId: z.number().int().positive(), source: z.enum(["field_visit", "referral", "inbound", "partner", "existing_relationship", "other"]).default("field_visit"), firstContactAt: z.string().datetime(), notes: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesCrmRoles);
    const [rep] = await db.select({ userId: tenantUsers.userId }).from(tenantUsers).innerJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, input.salesRepUserId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"), or(eq(appRoles.code, "sales"), eq(appRoles.code, "sales_rep")))).limit(1);
    if (!rep) throw new TRPCError({ code: "BAD_REQUEST", message: "المستخدم المحدد ليس ممثل مبيعات نشطاً ضمن الشركة." });
    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "الشركة أو العميل غير موجود ضمن الشركة الحالية." });
    const result = await db.insert(salesCustomerAttributions).values({ ...input, firstContactAt: new Date(input.firstContactAt), createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "sales.customer_attribution.created", entityType: "sales_customer_attribution", entityId: id, newValue: { customerId: input.customerId, salesRepUserId: input.salesRepUserId, source: input.source, firstContactAt: input.firstContactAt } });
    return { id };
  }),

  recordSalesVisit: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), contactId: z.number().int().positive().optional(), opportunityId: z.number().int().positive().optional(), salesRepUserId: z.number().int().positive(), visitType: z.enum(["in_person", "phone", "email", "whatsapp", "meeting"]), status: z.enum(["planned", "completed", "cancelled"]).default("completed"), visitedAt: z.string().datetime(), location: z.string().max(255).optional(), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional(), outcome: z.string().max(500).optional(), nextFollowUpDate: z.string().regex(isoDatePattern).optional(), notes: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesCrmRoles);
    const [rep] = await db.select({ userId: tenantUsers.userId }).from(tenantUsers).innerJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, input.salesRepUserId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"), or(eq(appRoles.code, "sales"), eq(appRoles.code, "sales_rep")))).limit(1);
    if (!rep) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تسجيل النشاط إلا لممثل مبيعات نشط." });
    const [customer] = await db.select({ id: customers.id, name: customers.name, accountTier: customers.accountTier }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId), eq(customers.isActive, true))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود أو غير نشط." });
    const result = await db.insert(salesVisits).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, contactId: input.contactId, opportunityId: input.opportunityId, salesRepUserId: input.salesRepUserId, visitType: input.visitType, status: input.status, visitedAt: new Date(input.visitedAt), location: input.location, latitude: input.latitude?.toFixed(7), longitude: input.longitude?.toFixed(7), outcome: input.outcome, nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : undefined, notes: input.notes, createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await db.update(salesCustomerAttributions).set({ lastContactAt: new Date(input.visitedAt) }).where(and(eq(salesCustomerAttributions.tenantId, input.tenantId), eq(salesCustomerAttributions.companyId, input.companyId), eq(salesCustomerAttributions.customerId, input.customerId), eq(salesCustomerAttributions.salesRepUserId, input.salesRepUserId), eq(salesCustomerAttributions.status, "active")));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "sales.visit.recorded", entityType: "sales_visit", entityId: id, newValue: { customerId: input.customerId, salesRepUserId: input.salesRepUserId, visitType: input.visitType, visitedAt: input.visitedAt, accountTier: customer.accountTier } });
    if (isLargeAccountTier(customer.accountTier)) await notifyManagementOfLargeAccountVisit(db, { tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, customerName: customer.name, salesRepUserId: input.salesRepUserId, visitId: id, visitedAt: input.visitedAt, location: input.location });
    return { id };
  }),

  salesRepDashboard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), salesRepUserId: z.number().int().positive(), weekStart: z.string().regex(isoDatePattern).optional() })).query(async ({ ctx, input }) => {
    const scopeAccess = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    const db = scopeAccess.db;
    if (scopeAccess.roleCode === "sales_rep" && input.salesRepUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك عرض أداء ممثل مبيعات آخر." });
    const start = input.weekStart ? new Date(`${input.weekStart}T00:00:00.000Z`) : (() => { const now = new Date(); const day = now.getUTCDay(); const mondayOffset = day === 0 ? -6 : 1 - day; return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset)); })();
    const end = new Date(start.getTime() + 7 * 86_400_000);
    const scope = [eq(salesVisits.tenantId, input.tenantId), eq(salesVisits.companyId, input.companyId), eq(salesVisits.salesRepUserId, input.salesRepUserId)];
    const visits = await db.select({ visit: salesVisits, customerName: customers.name }).from(salesVisits).leftJoin(customers, eq(customers.id, salesVisits.customerId)).where(and(...scope, gte(salesVisits.visitedAt, start), lte(salesVisits.visitedAt, new Date(end.getTime() - 1)))).orderBy(desc(salesVisits.visitedAt));
    const activities = await db.select({ activity: salesActivities }).from(salesActivities).where(and(eq(salesActivities.tenantId, input.tenantId), eq(salesActivities.companyId, input.companyId), eq(salesActivities.ownerUserId, input.salesRepUserId), gte(salesActivities.createdAt, start), lte(salesActivities.createdAt, new Date(end.getTime() - 1))));
    const opportunities = await db.select().from(salesOpportunities).where(and(eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId), eq(salesOpportunities.ownerUserId, input.salesRepUserId)));
    const commissionRows = await db.select().from(salesCommissionEntries).where(and(eq(salesCommissionEntries.tenantId, input.tenantId), eq(salesCommissionEntries.companyId, input.companyId), eq(salesCommissionEntries.salesRepUserId, input.salesRepUserId)));
    const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(start.getTime() + index * 86_400_000); const key = day.toISOString().slice(0, 10); return { date: key, label: day.toLocaleDateString("ar-SA", { weekday: "short" }), visits: visits.filter((row) => row.visit.visitedAt.toISOString().slice(0, 10) === key).length, activities: activities.filter((row) => row.activity.createdAt.toISOString().slice(0, 10) === key).length }; });
    const won = opportunities.filter((item) => item.stage === "won").length;
    return { period: { start: start.toISOString(), end: end.toISOString() }, visits, weeklyActivity: days, metrics: { fieldVisits: visits.filter((row) => row.visit.visitType === "in_person").length, totalVisits: visits.length, completedActivities: activities.filter((row) => row.activity.status === "completed").length, openActivities: activities.filter((row) => row.activity.status === "open").length, opportunities: opportunities.length, wonOpportunities: won, winRate: opportunities.length ? Number(((won / opportunities.length) * 100).toFixed(1)) : 0, weightedPipeline: addMoney(opportunities.map((item) => (Number(item.expectedValue) * item.probability / 100).toFixed(6))), pendingCommission: addMoney(commissionRows.filter((item) => item.status === "pending").map((item) => item.commissionAmount)), paidCommission: addMoney(commissionRows.filter((item) => item.status === "paid").map((item) => item.commissionAmount)) } };
  }),

  listSalesAttributions: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive().optional(), salesRepUserId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesCrmRoles);
    const ownerId = scope.roleCode === "sales_rep" ? ctx.user.id : input.salesRepUserId;
    return scope.db.select({ attribution: salesCustomerAttributions, repName: users.name, repEmail: users.email }).from(salesCustomerAttributions).leftJoin(users, eq(users.id, salesCustomerAttributions.salesRepUserId)).where(and(eq(salesCustomerAttributions.tenantId, input.tenantId), eq(salesCustomerAttributions.companyId, input.companyId), input.customerId ? eq(salesCustomerAttributions.customerId, input.customerId) : undefined, ownerId ? eq(salesCustomerAttributions.salesRepUserId, ownerId) : undefined)).orderBy(desc(salesCustomerAttributions.firstContactAt));
  }),

  listSalesVisits: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive().optional(), salesRepUserId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesCrmRoles);
    const ownerId = scope.roleCode === "sales_rep" ? ctx.user.id : input.salesRepUserId;
    return scope.db.select({ visit: salesVisits, repName: users.name, repEmail: users.email }).from(salesVisits).leftJoin(users, eq(users.id, salesVisits.salesRepUserId)).where(and(eq(salesVisits.tenantId, input.tenantId), eq(salesVisits.companyId, input.companyId), input.customerId ? eq(salesVisits.customerId, input.customerId) : undefined, ownerId ? eq(salesVisits.salesRepUserId, ownerId) : undefined)).orderBy(desc(salesVisits.visitedAt));
  }),

  createCommissionRule: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), nameAr: z.string().min(2).max(255), basis: z.enum(["contract_value", "invoice_paid"]).default("contract_value"), rateBps: z.number().int().min(1).max(10000), effectiveFrom: z.string().regex(isoDatePattern) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesCommissionAdminRoles);
    const result = await db.insert(salesCommissionRules).values({ ...input, effectiveFrom: new Date(input.effectiveFrom), createdByUserId: ctx.user.id });
    return { id: Number(result[0].insertId) };
  }),

  salesCommissionBoard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), salesRepUserId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesCrmRoles);
    const ownerId = scope.roleCode === "sales_rep" ? ctx.user.id : input.salesRepUserId;
    const entries = await scope.db.select({ commission: salesCommissionEntries, repName: users.name, repEmail: users.email, customerName: customers.name }).from(salesCommissionEntries).leftJoin(users, eq(users.id, salesCommissionEntries.salesRepUserId)).leftJoin(customers, eq(customers.id, salesCommissionEntries.customerId)).where(and(eq(salesCommissionEntries.tenantId, input.tenantId), eq(salesCommissionEntries.companyId, input.companyId), ownerId ? eq(salesCommissionEntries.salesRepUserId, ownerId) : undefined)).orderBy(desc(salesCommissionEntries.createdAt));
    return { entries, totals: { pending: entries.filter((row) => row.commission.status === "pending").reduce((sum, row) => sum + Number(row.commission.commissionAmount), 0).toFixed(6), approved: entries.filter((row) => row.commission.status === "approved").reduce((sum, row) => sum + Number(row.commission.commissionAmount), 0).toFixed(6), paid: entries.filter((row) => row.commission.status === "paid").reduce((sum, row) => sum + Number(row.commission.commissionAmount), 0).toFixed(6) } };
  }),

  salesPipelineSummary: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), ownerUserId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    const db = scope.db;
    const conditions = [eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId)];
    const effectiveOwnerId = scope.roleCode === "sales_rep" ? ctx.user.id : input.ownerUserId;
    if (effectiveOwnerId) conditions.push(eq(salesOpportunities.ownerUserId, effectiveOwnerId));
    const opportunities = await db.select().from(salesOpportunities).where(and(...conditions));
    const activities = await db.select().from(salesActivities).where(and(eq(salesActivities.tenantId, input.tenantId), eq(salesActivities.companyId, input.companyId), eq(salesActivities.status, "open"), scopedSalesOwner(scope.roleCode, ctx.user.id, salesActivities.ownerUserId)));
    const today = new Date().toISOString().slice(0, 10);
    const openPipeline = opportunities.filter((item) => !["won", "lost"].includes(item.stage));
    return { totalOpportunities: opportunities.length, openOpportunities: openPipeline.length, weightedPipeline: openPipeline.reduce((sum, item) => sum + Number(item.expectedValue) * (Number(item.probability) / 100), 0).toFixed(2), totalPipeline: openPipeline.reduce((sum, item) => sum + Number(item.expectedValue), 0).toFixed(2), wonValue: opportunities.filter((item) => item.stage === "won").reduce((sum, item) => sum + Number(item.expectedValue), 0).toFixed(2), overdueActivities: activities.filter((item) => item.dueDate && String(item.dueDate) < today).length, todayActivities: activities.filter((item) => item.dueDate && String(item.dueDate) === today).length, byStage: Object.fromEntries(["new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "on_hold"].map((stage) => [stage, opportunities.filter((item) => item.stage === stage).length])) };
  }),

  salesPerformanceReport: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), startDate: z.string().regex(isoDatePattern).optional(), endDate: z.string().regex(isoDatePattern).optional(), ownerUserId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    const db = scope.db;
    const effectiveOwnerId = scope.roleCode === "sales_rep" ? ctx.user.id : input.ownerUserId;
    const opportunities = await db.select({ opportunity: salesOpportunities, ownerName: users.name, ownerEmail: users.email }).from(salesOpportunities).leftJoin(users, eq(users.id, salesOpportunities.ownerUserId)).where(and(eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId), effectiveOwnerId ? eq(salesOpportunities.ownerUserId, effectiveOwnerId) : undefined, input.startDate ? gte(salesOpportunities.createdAt, new Date(`${input.startDate}T00:00:00.000Z`)) : undefined, input.endDate ? lte(salesOpportunities.createdAt, new Date(`${input.endDate}T23:59:59.999Z`)) : undefined));
    const histories = await db.select().from(salesOpportunityStageHistory).where(and(eq(salesOpportunityStageHistory.tenantId, input.tenantId), eq(salesOpportunityStageHistory.companyId, input.companyId), effectiveOwnerId ? eq(salesOpportunityStageHistory.ownerUserId, effectiveOwnerId) : undefined, input.startDate ? gte(salesOpportunityStageHistory.changedAt, new Date(`${input.startDate}T00:00:00.000Z`)) : undefined, input.endDate ? lte(salesOpportunityStageHistory.changedAt, new Date(`${input.endDate}T23:59:59.999Z`)) : undefined));
    const activities = await db.select().from(salesActivities).where(and(eq(salesActivities.tenantId, input.tenantId), eq(salesActivities.companyId, input.companyId), effectiveOwnerId ? eq(salesActivities.ownerUserId, effectiveOwnerId) : scopedSalesOwner(scope.roleCode, ctx.user.id, salesActivities.ownerUserId), input.startDate ? gte(salesActivities.createdAt, new Date(`${input.startDate}T00:00:00.000Z`)) : undefined, input.endDate ? lte(salesActivities.createdAt, new Date(`${input.endDate}T23:59:59.999Z`)) : undefined));
    const stageOrder = ["new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "on_hold"] as const;
    const stageLabels: Record<string, string> = { new_lead: "عميل محتمل", qualified: "مؤهل", discovery: "اكتشاف الاحتياج", proposal: "عرض سعر", negotiation: "تفاوض", won: "تم الفوز", lost: "خاسرة", on_hold: "معلقة" };
    const transitions = stageOrder.map((fromStage, index) => { const toStage = stageOrder[index + 1]; const entered = histories.filter((item) => item.fromStage === fromStage).length; const advanced = toStage ? histories.filter((item) => item.fromStage === fromStage && item.toStage === toStage).length : 0; return { fromStage, fromLabel: stageLabels[fromStage], toStage: toStage ?? null, toLabel: toStage ? stageLabels[toStage] : null, entered, advanced, conversionRate: entered ? Number(((advanced / entered) * 100).toFixed(2)) : 0 }; });
    const repMap = new Map<number, { userId: number; name: string; email: string; opportunities: number; open: number; won: number; lost: number; expectedValue: number; weightedValue: number; activities: number; completedActivities: number; overdueActivities: number }>();
    const today = new Date().toISOString().slice(0, 10);
    for (const row of opportunities) { const item = row.opportunity; const current = repMap.get(item.ownerUserId) ?? { userId: item.ownerUserId, name: row.ownerName || "غير مسمى", email: row.ownerEmail || "", opportunities: 0, open: 0, won: 0, lost: 0, expectedValue: 0, weightedValue: 0, activities: 0, completedActivities: 0, overdueActivities: 0 }; current.opportunities += 1; current.open += ["won", "lost"].includes(item.stage) ? 0 : 1; current.won += item.stage === "won" ? 1 : 0; current.lost += item.stage === "lost" ? 1 : 0; current.expectedValue += Number(item.expectedValue); current.weightedValue += Number(item.expectedValue) * Number(item.probability) / 100; repMap.set(item.ownerUserId, current); }
    for (const activity of activities) { const current = repMap.get(activity.ownerUserId); if (!current) continue; current.activities += 1; current.completedActivities += activity.status === "completed" ? 1 : 0; current.overdueActivities += activity.status === "open" && activity.dueDate && String(activity.dueDate) < today ? 1 : 0; }
    const reps = Array.from(repMap.values()).map((rep) => ({ ...rep, winRate: rep.opportunities ? Number(((rep.won / rep.opportunities) * 100).toFixed(2)) : 0, activityCompletionRate: rep.activities ? Number(((rep.completedActivities / rep.activities) * 100).toFixed(2)) : 0, expectedValue: rep.expectedValue.toFixed(2), weightedValue: rep.weightedValue.toFixed(2) })).sort((a, b) => b.weightedValue.localeCompare(a.weightedValue));
    return { period: { startDate: input.startDate ?? null, endDate: input.endDate ?? null }, totalOpportunities: opportunities.length, totalExpectedValue: opportunities.reduce((sum, row) => sum + Number(row.opportunity.expectedValue), 0).toFixed(2), totalWeightedValue: opportunities.reduce((sum, row) => sum + Number(row.opportunity.expectedValue) * Number(row.opportunity.probability) / 100, 0).toFixed(2), transitions, reps, historyCoverage: histories.length > 0 };
  }),

  listSalesOpportunities: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), search: z.string().trim().max(255).optional(), stage: z.enum(["all", "new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "on_hold"]).default("all"), ownerUserId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    const db = scope.db;
    const conditions = [eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId)];
    if (input.stage !== "all") conditions.push(eq(salesOpportunities.stage, input.stage));
    if (scope.roleCode === "sales_rep") conditions.push(eq(salesOpportunities.ownerUserId, ctx.user.id));
    else if (input.ownerUserId) conditions.push(eq(salesOpportunities.ownerUserId, input.ownerUserId));
    if (input.search) { const term = `%${input.search}%`; conditions.push(or(like(salesOpportunities.title, term), like(customers.name, term))!); }
    return db.select({ opportunity: salesOpportunities, customerName: customers.name, ownerName: users.name, ownerEmail: users.email }).from(salesOpportunities).innerJoin(customers, eq(customers.id, salesOpportunities.customerId)).leftJoin(users, eq(users.id, salesOpportunities.ownerUserId)).where(and(...conditions)).orderBy(desc(salesOpportunities.updatedAt));
  }),

  createSalesOpportunity: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), contactId: z.number().int().positive().optional(), ownerUserId: z.number().int().positive(), title: z.string().min(2).max(255), stage: z.enum(["new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "on_hold"]).default("new_lead"), probability: z.number().int().min(0).max(100).default(10), expectedValue: money.default("0"), expectedCloseDate: z.string().regex(isoDatePattern).optional(), source: z.string().max(128).optional(), serviceInterest: z.string().max(255).optional(), nextAction: z.string().max(500).optional(), nextActionDate: z.string().regex(isoDatePattern).optional(), lostReason: z.string().max(500).optional(), notes: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId);
    const db = scope.db;
    const effectiveOwnerUserId = scope.roleCode === "sales_rep" ? ctx.user.id : input.ownerUserId;
    if (scope.roleCode === "sales_rep" && input.ownerUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ممثل المبيعات لا يستطيع إنشاء فرصة باسم موظف آخر." });
    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId), eq(customers.isActive, true), scopedSalesOwner(scope.roleCode, ctx.user.id, customers.salesOwnerUserId))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود أو غير نشط." });
    const [owner] = await db.select({ userId: tenantUsers.userId }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, effectiveOwnerUserId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"), or(eq(appRoles.code, "sales"), eq(appRoles.code, "sales_rep")))).limit(1);
    if (!owner) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "مسؤول الفرصة يجب أن يكون موظف مبيعات نشطاً." });
    if (input.contactId) { const [contact] = await db.select({ id: customerContacts.id }).from(customerContacts).where(and(eq(customerContacts.id, input.contactId), eq(customerContacts.customerId, input.customerId), eq(customerContacts.tenantId, input.tenantId), eq(customerContacts.companyId, input.companyId), eq(customerContacts.isActive, true))).limit(1); if (!contact) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "جهة الاتصال لا تتبع للعميل المختار." }); }
    const result = await db.insert(salesOpportunities).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, contactId: input.contactId, ownerUserId: effectiveOwnerUserId, title: input.title, stage: input.stage, probability: input.probability, expectedValue: input.expectedValue, expectedCloseDate: input.expectedCloseDate ? new Date(`${input.expectedCloseDate}T00:00:00.000Z`) : null, source: input.source, serviceInterest: input.serviceInterest, nextAction: input.nextAction, nextActionDate: input.nextActionDate ? new Date(`${input.nextActionDate}T00:00:00.000Z`) : null, lostReason: input.lostReason, notes: input.notes, createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await db.insert(salesOpportunityStageHistory).values({ tenantId: input.tenantId, companyId: input.companyId, opportunityId: id, ownerUserId: effectiveOwnerUserId, fromStage: null, toStage: input.stage, changedByUserId: ctx.user.id });
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "sales.opportunity_created", entityType: "sales_opportunity", entityId: id, newValue: { title: input.title, customerId: input.customerId, ownerUserId: effectiveOwnerUserId, stage: input.stage } });
    return { id };
  }),

  reassignSalesOpportunity: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), opportunityId: z.number().int().positive(), ownerUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesCrmRoles);
    if (scope.roleCode === "sales_rep") throw new TRPCError({ code: "FORBIDDEN", message: "إعادة توزيع الفرص مخصصة لمشرف المبيعات والإدارة المخولة." });
    const [owner] = await scope.db.select({ userId: tenantUsers.userId, roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, input.ownerUserId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))).limit(1);
    if (!owner || !["sales", "sales_rep"].includes(owner.roleCode ?? "")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اختر ممثلاً نشطاً من قسم المبيعات." });
    const [opportunity] = await scope.db.select({ id: salesOpportunities.id, ownerUserId: salesOpportunities.ownerUserId }).from(salesOpportunities).where(and(eq(salesOpportunities.id, input.opportunityId), eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId))).limit(1);
    if (!opportunity) throw new TRPCError({ code: "NOT_FOUND", message: "الفرصة غير موجودة ضمن الشركة الحالية." });
    await scope.db.update(salesOpportunities).set({ ownerUserId: input.ownerUserId }).where(eq(salesOpportunities.id, opportunity.id));
    await appendAuditLog(scope.db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "sales.opportunity_reassigned", entityType: "sales_opportunity", entityId: opportunity.id, previousValue: { ownerUserId: opportunity.ownerUserId }, newValue: { ownerUserId: input.ownerUserId } });
    return { opportunityId: opportunity.id, ownerUserId: input.ownerUserId } as const;
  }),

  updateSalesOpportunity: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), opportunityId: z.number().int().positive(), stage: z.enum(["new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost", "on_hold"]).optional(), probability: z.number().int().min(0).max(100).optional(), expectedValue: money.optional(), expectedCloseDate: z.string().regex(isoDatePattern).nullable().optional(), nextAction: z.string().max(500).nullable().optional(), nextActionDate: z.string().regex(isoDatePattern).nullable().optional(), lostReason: z.string().max(500).nullable().optional(), notes: z.string().max(4000).nullable().optional() })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId);
    const db = scope.db;
    const [existing] = await db.select().from(salesOpportunities).where(and(eq(salesOpportunities.id, input.opportunityId), eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId), scopedSalesOwner(scope.roleCode, ctx.user.id, salesOpportunities.ownerUserId))).limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "الفرصة غير موجودة." });
    const { opportunityId, tenantId, companyId } = input;
    const changes = { stage: input.stage, probability: input.probability, expectedValue: input.expectedValue, expectedCloseDate: input.expectedCloseDate === undefined ? undefined : input.expectedCloseDate ? new Date(`${input.expectedCloseDate}T00:00:00.000Z`) : null, nextAction: input.nextAction, nextActionDate: input.nextActionDate === undefined ? undefined : input.nextActionDate ? new Date(`${input.nextActionDate}T00:00:00.000Z`) : null, lostReason: input.lostReason, notes: input.notes };
    await db.update(salesOpportunities).set(changes).where(and(eq(salesOpportunities.id, opportunityId), eq(salesOpportunities.tenantId, tenantId), eq(salesOpportunities.companyId, companyId)));
    if (input.stage && input.stage !== existing.stage) await db.insert(salesOpportunityStageHistory).values({ tenantId, companyId, opportunityId, ownerUserId: existing.ownerUserId, fromStage: existing.stage, toStage: input.stage, changedByUserId: ctx.user.id });
    await appendAuditLog(db, { tenantId, companyId, actorUserId: ctx.user.id, action: "sales.opportunity_updated", entityType: "sales_opportunity", entityId: opportunityId, previousValue: { stage: existing.stage, probability: existing.probability }, newValue: changes });
    return { id: opportunityId };
  }),

  listSalesActivities: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive().optional(), opportunityId: z.number().int().positive().optional(), status: z.enum(["all", "open", "completed", "cancelled"]).default("all") })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    const db = scope.db;
    const conditions = [eq(salesActivities.tenantId, input.tenantId), eq(salesActivities.companyId, input.companyId), scopedSalesOwner(scope.roleCode, ctx.user.id, salesActivities.ownerUserId)];
    if (input.customerId) conditions.push(eq(salesActivities.customerId, input.customerId));
    if (input.opportunityId) conditions.push(eq(salesActivities.opportunityId, input.opportunityId));
    if (input.status !== "all") conditions.push(eq(salesActivities.status, input.status));
    return db.select({ activity: salesActivities, customerName: customers.name, ownerName: users.name }).from(salesActivities).innerJoin(customers, eq(customers.id, salesActivities.customerId)).leftJoin(users, eq(users.id, salesActivities.ownerUserId)).where(and(...conditions)).orderBy(desc(salesActivities.dueDate), desc(salesActivities.createdAt));
  }),

  createSalesActivity: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), opportunityId: z.number().int().positive().optional(), ownerUserId: z.number().int().positive(), activityType: z.enum(["call", "meeting", "email", "task", "note"]), subject: z.string().min(2).max(255), notes: z.string().max(4000).optional(), dueDate: z.string().regex(isoDatePattern).optional() })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId);
    const db = scope.db;
    const effectiveOwnerUserId = scope.roleCode === "sales_rep" ? ctx.user.id : input.ownerUserId;
    if (scope.roleCode === "sales_rep" && input.ownerUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ممثل المبيعات لا يستطيع تسجيل متابعة باسم موظف آخر." });
    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId), eq(customers.isActive, true), scopedSalesOwner(scope.roleCode, ctx.user.id, customers.salesOwnerUserId))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود أو غير نشط." });
    if (input.opportunityId) { const [opportunity] = await db.select({ id: salesOpportunities.id }).from(salesOpportunities).where(and(eq(salesOpportunities.id, input.opportunityId), eq(salesOpportunities.customerId, input.customerId), eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId))).limit(1); if (!opportunity) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الفرصة لا تتبع للعميل المختار." }); }
    const result = await db.insert(salesActivities).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, opportunityId: input.opportunityId, ownerUserId: effectiveOwnerUserId, activityType: input.activityType, subject: input.subject, notes: input.notes, dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null, createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "sales.activity_created", entityType: "sales_activity", entityId: id, newValue: { customerId: input.customerId, opportunityId: input.opportunityId, subject: input.subject, dueDate: input.dueDate } });
    return { id };
  }),

  completeSalesActivity: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), activityId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    const db = scope.db;
    const [activity] = await db.select().from(salesActivities).where(and(eq(salesActivities.id, input.activityId), eq(salesActivities.tenantId, input.tenantId), eq(salesActivities.companyId, input.companyId), scopedSalesOwner(scope.roleCode, ctx.user.id, salesActivities.ownerUserId))).limit(1);
    if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "النشاط غير موجود." });
    await db.update(salesActivities).set({ status: "completed", completedAt: new Date() }).where(eq(salesActivities.id, input.activityId));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "sales.activity_completed", entityType: "sales_activity", entityId: input.activityId, previousValue: { status: activity.status }, newValue: { status: "completed" } });
    return { id: input.activityId, status: "completed" as const };
  }),

  listCustomerContacts: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    await accessOwnedSalesCustomer(scope.db, scope.roleCode, ctx.user.id, input);
    return scope.db.select().from(customerContacts).where(and(eq(customerContacts.tenantId, input.tenantId), eq(customerContacts.companyId, input.companyId), eq(customerContacts.customerId, input.customerId), eq(customerContacts.isActive, true)));
  }),

  listCustomerContracts: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    await accessOwnedSalesCustomer(scope.db, scope.roleCode, ctx.user.id, input);
    return scope.db.select({ contract: customerContracts, document: { id: documents.id, filename: documents.filename, fileKey: documents.fileKey } }).from(customerContracts).leftJoin(documents, eq(documents.id, customerContracts.documentId)).where(and(eq(customerContracts.tenantId, input.tenantId), eq(customerContracts.companyId, input.companyId), eq(customerContracts.customerId, input.customerId))).orderBy(customerContracts.endDate, customerContracts.createdAt);
  }),

  getCustomerPaymentSummary: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    rejectFinancialSalesRole(scope.roleCode);
    const customer = await accessOwnedSalesCustomer(scope.db, scope.roleCode, ctx.user.id, input);
    const invoiceRows = await scope.db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, issueDate: invoices.issueDate, dueDate: invoices.dueDate, grandTotal: invoices.grandTotal, paidTotal: invoices.paidTotal }).from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), eq(invoices.customerId, input.customerId))).orderBy(invoices.dueDate, invoices.issueDate);
    return { customer, ...buildCustomerPaymentSummary(invoiceRows) };
  }),

  collectionsBoard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), startDate: z.string().regex(isoDatePattern).optional(), endDate: z.string().regex(isoDatePattern).optional(), status: z.enum(["all", "overdue", "upcoming", "pending", "partially_paid", "paid"]).default("all"), paymentStatus: z.enum(["all", "paid", "partially_paid", "unpaid"]).default("all"), search: z.string().max(160).optional(), salesOwnerUserId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    rejectFinancialSalesRole(scope.roleCode);
    const db = scope.db;
    const filters = [eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId)];
    if (input.startDate) filters.push(gte(invoices.issueDate, new Date(`${input.startDate}T00:00:00.000Z`)));
    if (input.endDate) filters.push(lte(invoices.issueDate, new Date(`${input.endDate}T23:59:59.999Z`)));
    if (input.salesOwnerUserId) filters.push(eq(customers.salesOwnerUserId, input.salesOwnerUserId));
    const search = input.search?.trim();
    if (search) filters.push(or(like(invoices.invoiceNumber, `%${search}%`), like(customers.name, `%${search}%`))!);
    const rows = await db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, issueDate: invoices.issueDate, dueDate: invoices.dueDate, grandTotal: invoices.grandTotal, paidTotal: invoices.paidTotal, customerId: customers.id, customerName: customers.name, salesOwnerUserId: customers.salesOwnerUserId, salesOwnerName: users.name, salesOwnerEmail: users.email }).from(invoices).innerJoin(customers, eq(customers.id, invoices.customerId)).leftJoin(users, eq(users.id, customers.salesOwnerUserId)).where(and(...filters));
    const summary = buildCustomerPaymentSummary(rows.map(({ customerId: _customerId, customerName: _customerName, salesOwnerUserId: _ownerId, salesOwnerName: _ownerName, salesOwnerEmail: _ownerEmail, ...invoice }) => invoice));
    const details = summary.invoices.map((invoice) => { const row = rows.find((item) => item.id === invoice.id)!; return { ...invoice, customerId: row.customerId, customerName: row.customerName, salesOwnerUserId: row.salesOwnerUserId, salesOwnerName: row.salesOwnerName, salesOwnerEmail: row.salesOwnerEmail }; }).filter((invoice) => { const dueMatch = input.status === "all" || input.status === "partially_paid" ? invoice.settlementStatus === "partially_paid" : input.status === "paid" ? invoice.settlementStatus === "paid" : invoice.paymentStatus === input.status; const paymentMatch = input.paymentStatus === "all" || input.paymentStatus === "paid" ? invoice.settlementStatus === "paid" : input.paymentStatus === "partially_paid" ? invoice.settlementStatus === "partially_paid" : invoice.settlementStatus === "unpaid"; return dueMatch && paymentMatch; });
    const totalInvoiced = addMoney(details.map((item) => item.grandTotal)); const totalPaid = addMoney(details.map((item) => item.paidTotal)); const remainingBalance = addMoney(details.map((item) => item.outstanding));
    return { totalInvoiced, totalPaid, remainingBalance, overdue: details.filter((item) => item.paymentStatus === "overdue"), upcoming: details.filter((item) => item.paymentStatus === "upcoming"), invoices: details.sort((a, b) => (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER)) };
  }),

  listCollectionFollowUps: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), invoiceId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    rejectFinancialSalesRole(scope.roleCode);
    const db = scope.db;
    return db.select({ id: auditLogs.id, createdAt: auditLogs.createdAt, actorUserId: auditLogs.actorUserId, actorName: users.name, newValue: auditLogs.newValue }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).where(and(eq(auditLogs.tenantId, input.tenantId), eq(auditLogs.companyId, input.companyId), eq(auditLogs.entityType, "invoice"), eq(auditLogs.entityId, input.invoiceId), eq(auditLogs.action, "collection.follow_up_logged"))).orderBy(desc(auditLogs.createdAt));
  }),

  logCollectionFollowUp: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), invoiceId: z.number().int().positive(), note: z.string().min(2).max(2000), nextFollowUpDate: z.string().regex(isoDatePattern).optional() })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    rejectFinancialSalesRole(scope.roleCode);
    const db = scope.db;
    const [invoice] = await db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, customerId: invoices.customerId }).from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId))).limit(1);
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "الفاتورة غير موجودة ضمن الشركة الحالية." });
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "collection.follow_up_logged", entityType: "invoice", entityId: invoice.id, newValue: { invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId, note: input.note.trim(), nextFollowUpDate: input.nextFollowUpDate ?? null } });
    return { invoiceId: invoice.id };
  }),

  sendOverduePaymentReminder: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), invoiceId: z.number().int().positive(), channel: z.enum(["email", "whatsapp"]) })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    rejectFinancialSalesRole(scope.roleCode);
    const db = scope.db;
    const [row] = await db.select({ invoice: invoices, customer: customers, companyName: companies.legalNameAr }).from(invoices).innerJoin(customers, eq(customers.id, invoices.customerId)).innerJoin(companies, eq(companies.id, invoices.companyId)).where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId))).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "الفاتورة غير موجودة ضمن الشركة الحالية." });
    const outstanding = subtractMoney(row.invoice.grandTotal, row.invoice.paidTotal);
    if (outstanding === "0.000000" || ["draft", "pending_approval", "rejected", "credit_note_issued"].includes(row.invoice.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إرسال تذكير لفاتورة غير مستحقة أو غير صالحة للتحصيل." });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const existing = await db.select({ id: auditLogs.id }).from(auditLogs).where(and(eq(auditLogs.tenantId, input.tenantId), eq(auditLogs.companyId, input.companyId), eq(auditLogs.entityType, "invoice"), eq(auditLogs.entityId, input.invoiceId), eq(auditLogs.action, `collection.reminder.${input.channel}`), gte(auditLogs.createdAt, todayStart))).limit(1);
    if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "تم إرسال تذكير بهذه القناة لهذه الفاتورة اليوم بالفعل." });
    const dueDate = row.invoice.dueDate ? new Date(row.invoice.dueDate).toISOString().slice(0, 10) : "غير محدد";
    const reminderInput = { customerName: row.customer.name, invoiceNumber: row.invoice.invoiceNumber, outstanding, dueDate, companyName: row.companyName, publicAppUrl: process.env.PUBLIC_APP_URL };
    if (input.channel === "email") {
      if (!row.customer.email) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يوجد بريد إلكتروني محفوظ لهذا العميل." });
      const sent = await sendPaymentReminderEmail({ ...reminderInput, to: row.customer.email });
      await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "collection.reminder.email", entityType: "invoice", entityId: input.invoiceId, newValue: { invoiceNumber: row.invoice.invoiceNumber, customerId: row.customer.id, recipient: row.customer.email, messageId: sent.messageId } });
      return { channel: input.channel, sent: true, recipient: row.customer.email };
    }
    if (!row.customer.phone) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يوجد رقم جوال محفوظ لهذا العميل." });
    const whatsappUrl = buildWhatsAppReminderUrl({ ...reminderInput, phone: row.customer.phone });
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "collection.reminder.whatsapp", entityType: "invoice", entityId: input.invoiceId, newValue: { invoiceNumber: row.invoice.invoiceNumber, customerId: row.customer.id, recipient: row.customer.phone, delivery: "direct_link" } });
    return { channel: input.channel, sent: false, recipient: row.customer.phone, whatsappUrl };
  }),

  listQuotations: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    return scope.db.select().from(quotations).where(and(eq(quotations.tenantId, input.tenantId), eq(quotations.companyId, input.companyId), scopedSalesOwner(scope.roleCode, ctx.user.id, quotations.salesOwnerUserId))).orderBy(quotations.createdAt);
  }),

  listInvoices: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId);
    rejectFinancialSalesRole(scope.roleCode);
    const quoteFilters = [eq(quotations.tenantId, input.tenantId), eq(quotations.companyId, input.companyId)];
    if (scope.roleCode === "sales_rep") quoteFilters.push(eq(quotations.salesOwnerUserId, ctx.user.id));
    else if (scope.roleCode === "sales") quoteFilters.push(isNotNull(quotations.salesOwnerUserId));
    else return scope.db.select().from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId))).orderBy(invoices.createdAt);
    const ownedQuotes = await scope.db.select({ id: quotations.id }).from(quotations).where(and(...quoteFilters));
    if (!ownedQuotes.length) return [];
    return scope.db.select().from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), inArray(invoices.quotationId, ownedQuotes.map((quote) => quote.id)))).orderBy(invoices.createdAt);
  }),

  getQuotationDocument: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), quotationId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, salesReadRoles);
    const [document] = await scope.db.select({ quotation: quotations, customer: customers, company: companies }).from(quotations).innerJoin(customers, eq(customers.id, quotations.customerId)).innerJoin(companies, eq(companies.id, quotations.companyId)).where(and(eq(quotations.id, input.quotationId), eq(quotations.tenantId, input.tenantId), eq(quotations.companyId, input.companyId), scopedSalesOwner(scope.roleCode, ctx.user.id, quotations.salesOwnerUserId))).limit(1);
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "عرض السعر غير موجود ضمن الشركة الحالية." });
    const lines = await scope.db.select().from(quotationLines).where(and(eq(quotationLines.tenantId, input.tenantId), eq(quotationLines.quotationId, input.quotationId))).orderBy(quotationLines.sortOrder);
    return { ...document, lines };
  }),

  getInvoiceDocument: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), invoiceId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [document] = await db.select({ invoice: invoices, customer: customers, company: companies }).from(invoices).innerJoin(customers, eq(customers.id, invoices.customerId)).innerJoin(companies, eq(companies.id, invoices.companyId)).where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId))).limit(1);
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "الفاتورة غير موجودة ضمن الشركة الحالية." });
    const lines = await db.select().from(invoiceLines).where(and(eq(invoiceLines.tenantId, input.tenantId), eq(invoiceLines.invoiceId, input.invoiceId))).orderBy(invoiceLines.sortOrder);
    return { ...document, lines };
  }),

  createCustomer: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), name: z.string().min(2).max(255), customerType: z.enum(["individual", "company", "government"]).default("company"), unifiedNumber: z.string().max(64).optional(), vatNumber: z.string().max(32).optional(), email: z.string().email().optional(), phone: z.string().max(32).optional(), primaryContactName: z.string().min(2).max(255).optional(), primaryContactTitle: z.string().max(255).optional(), primaryContactEmail: z.string().email().optional(), primaryContactPhone: z.string().max(255).optional(), salesOwnerUserId: z.number().int().positive().optional(), businessModel: z.enum(["b2b", "b2c", "b2g"]).default("b2b"), accountTier: customerAccountTier.default("standard") })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId);
    const db = scope.db;
    const effectiveSalesOwnerUserId = scope.roleCode === "sales_rep" ? ctx.user.id : input.salesOwnerUserId;
    if (scope.roleCode === "sales_rep" && input.salesOwnerUserId && input.salesOwnerUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ممثل المبيعات لا يستطيع تعيين العميل لممثل آخر." });
    if (effectiveSalesOwnerUserId) {
      const [owner] = await db.select({ roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, effectiveSalesOwnerUserId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))).limit(1);
      if (!owner || !["sales", "sales_rep"].includes(owner.roleCode ?? "")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اختر موظفاً نشطاً من قسم المبيعات مسؤولاً عن العميل." });
    }
    if (!validateCustomerIdentity(input)) throw new TRPCError({ code: "BAD_REQUEST", message: "للشركة يجب إدخال الرقم الضريبي المكون من 15 رقماً والرقم الموحد المكون من 10 أرقام." });
    if (input.vatNumber) {
      const [duplicate] = await db.select({ id: customers.id, name: customers.name }).from(customers).where(and(eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId), eq(customers.vatNumber, input.vatNumber))).limit(1);
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: `يوجد عميل مسجل مسبقاً بهذا الرقم الضريبي: ${duplicate.name}. راجع بيانات العميل قبل إنشاء سجل جديد.` });
    }
    return db.transaction(async (tx) => {
      const result = await tx.insert(customers).values({ tenantId: input.tenantId, companyId: input.companyId, name: input.name, customerType: input.customerType, businessModel: input.customerType === "individual" ? "b2c" : input.customerType === "government" ? "b2g" : "b2b", unifiedNumber: input.unifiedNumber, vatNumber: input.vatNumber, email: input.email ?? input.primaryContactEmail, phone: input.phone ?? input.primaryContactPhone, primaryContactName: input.primaryContactName, primaryContactTitle: input.primaryContactTitle, primaryContactEmail: input.primaryContactEmail, primaryContactPhone: input.primaryContactPhone, salesOwnerUserId: effectiveSalesOwnerUserId, accountTier: input.accountTier });
      const customerId = Number(result[0].insertId);
      if (input.primaryContactName) await tx.insert(customerContacts).values({ tenantId: input.tenantId, companyId: input.companyId, customerId, name: input.primaryContactName, jobTitle: input.primaryContactTitle, email: input.primaryContactEmail, phone: input.primaryContactPhone, isPrimary: true });
      if (effectiveSalesOwnerUserId) await tx.insert(salesCustomerAttributions).values({ tenantId: input.tenantId, companyId: input.companyId, customerId, salesRepUserId: effectiveSalesOwnerUserId, source: "field_visit", status: "active", firstContactAt: new Date(), createdByUserId: ctx.user.id });
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "customer.created", entityType: "customer", entityId: customerId, newValue: { salesOwnerUserId: effectiveSalesOwnerUserId, primaryContactName: input.primaryContactName, acquisitionAttributed: Boolean(effectiveSalesOwnerUserId) } });
      return { id: customerId };
    });
  }),

  addCustomerContact: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), name: z.string().min(2).max(255), jobTitle: z.string().max(255).optional(), email: z.string().email().optional(), phone: z.string().max(32).optional(), isPrimary: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود ضمن الشركة الحالية." });
    return db.transaction(async (tx) => {
      if (input.isPrimary) await tx.update(customerContacts).set({ isPrimary: false }).where(and(eq(customerContacts.customerId, input.customerId), eq(customerContacts.tenantId, input.tenantId)));
      const result = await tx.insert(customerContacts).values(input);
      const id = Number(result[0].insertId);
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "customer.contact_added", entityType: "customer_contact", entityId: id, newValue: { customerId: input.customerId, isPrimary: input.isPrimary } });
      return { id };
    });
  }),

  updateCustomer: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), name: z.string().min(2).max(255), vatNumber: z.string().max(32).optional(), email: z.string().email().optional(), phone: z.string().max(32).optional(), salesOwnerUserId: z.number().int().positive().nullable().optional(), accountTier: customerAccountTier.default("standard") })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    if (input.salesOwnerUserId) {
      const [owner] = await db.select({ roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, input.salesOwnerUserId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))).limit(1);
      if (!owner || !["sales", "sales_rep"].includes(owner.roleCode ?? "")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "اختر موظفاً نشطاً من قسم المبيعات مسؤولاً عن العميل." });
    }
    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود ضمن الشركة الحالية." });
    await db.update(customers).set({ name: input.name, vatNumber: input.vatNumber, email: input.email, phone: input.phone, salesOwnerUserId: input.salesOwnerUserId ?? null, accountTier: input.accountTier }).where(eq(customers.id, input.customerId));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "customer.updated", entityType: "customer", entityId: input.customerId, newValue: { salesOwnerUserId: input.salesOwnerUserId ?? null } });
    return { id: input.customerId };
  }),

  updateCustomerContact: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), contactId: z.number().int().positive(), name: z.string().min(2).max(255), jobTitle: z.string().max(255).optional(), email: z.string().email().optional(), phone: z.string().max(32).optional(), isPrimary: z.boolean().default(false), isActive: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    const [contact] = await db.select({ id: customerContacts.id }).from(customerContacts).where(and(eq(customerContacts.id, input.contactId), eq(customerContacts.customerId, input.customerId), eq(customerContacts.tenantId, input.tenantId), eq(customerContacts.companyId, input.companyId))).limit(1);
    if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "جهة الاتصال غير موجودة ضمن العميل الحالي." });
    return db.transaction(async (tx) => {
      if (input.isPrimary && input.isActive) await tx.update(customerContacts).set({ isPrimary: false }).where(and(eq(customerContacts.customerId, input.customerId), eq(customerContacts.tenantId, input.tenantId)));
      await tx.update(customerContacts).set({ name: input.name, jobTitle: input.jobTitle, email: input.email, phone: input.phone, isPrimary: input.isPrimary && input.isActive, isActive: input.isActive }).where(eq(customerContacts.id, input.contactId));
      if (input.isPrimary && input.isActive) await tx.update(customers).set({ primaryContactName: input.name, primaryContactTitle: input.jobTitle, primaryContactEmail: input.email, primaryContactPhone: input.phone, email: input.email, phone: input.phone }).where(eq(customers.id, input.customerId));
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: input.isActive ? "customer.contact_updated" : "customer.contact_disabled", entityType: "customer_contact", entityId: input.contactId, newValue: { customerId: input.customerId, isPrimary: input.isPrimary, isActive: input.isActive } });
      return { id: input.contactId };
    });
  }),

  createCustomerContract: protectedProcedure.input(contractInput).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    if (input.endDate && input.startDate && input.endDate < input.startDate) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ انتهاء العقد يجب أن يكون بعد تاريخ البداية." });
    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود ضمن الشركة الحالية." });
    if (input.documentId) {
      const [document] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId), eq(documents.classification, "contract"))).limit(1);
      if (!document) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المستند المحدد ليس عقداً محفوظاً للشركة الحالية." });
    }
    const [duplicate] = await db.select({ id: customerContracts.id }).from(customerContracts).where(and(eq(customerContracts.tenantId, input.tenantId), eq(customerContracts.companyId, input.companyId), eq(customerContracts.contractNumber, input.contractNumber))).limit(1);
    if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "رقم العقد مستخدم بالفعل داخل الشركة." });
    const result = await db.insert(customerContracts).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, contractNumber: input.contractNumber, title: input.title, status: input.status, startDate: input.startDate ? new Date(input.startDate) : undefined, endDate: input.endDate ? new Date(input.endDate) : undefined, contractValue: input.contractValue, documentId: input.documentId ?? null, notes: input.notes, createdByUserId: ctx.user.id });
    const contractId = Number(result[0].insertId);
    const attribution = input.salesRepUserId ? { salesRepUserId: input.salesRepUserId } : (await db.select({ salesRepUserId: salesCustomerAttributions.salesRepUserId }).from(salesCustomerAttributions).where(and(eq(salesCustomerAttributions.tenantId, input.tenantId), eq(salesCustomerAttributions.companyId, input.companyId), eq(salesCustomerAttributions.customerId, input.customerId), eq(salesCustomerAttributions.status, "active"))).orderBy(desc(salesCustomerAttributions.firstContactAt)).limit(1))[0];
    let commissionId: number | undefined;
    if (attribution?.salesRepUserId) {
      const effectiveDate = input.startDate ? new Date(input.startDate) : new Date();
      const [rule] = await db.select().from(salesCommissionRules).where(and(eq(salesCommissionRules.tenantId, input.tenantId), eq(salesCommissionRules.companyId, input.companyId), eq(salesCommissionRules.basis, "contract_value"), eq(salesCommissionRules.isActive, true), lte(salesCommissionRules.effectiveFrom, effectiveDate))).orderBy(desc(salesCommissionRules.effectiveFrom)).limit(1);
      if (rule) {
        const commissionAmount = calculateSalesCommissionAmount(input.contractValue, rule.rateBps);
        const commissionResult = await db.insert(salesCommissionEntries).values({ tenantId: input.tenantId, companyId: input.companyId, ruleId: rule.id, salesRepUserId: attribution.salesRepUserId, customerId: input.customerId, opportunityId: null, contractId, invoiceId: null, basis: "contract_value", basisAmount: input.contractValue, rateBps: rule.rateBps, commissionAmount, status: "pending", createdByUserId: ctx.user.id });
        commissionId = Number(commissionResult[0].insertId);
      }
    }
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "customer.contract_created", entityType: "customer_contract", entityId: contractId, newValue: { customerId: input.customerId, contractNumber: input.contractNumber, status: input.status, contractValue: input.contractValue, salesRepUserId: attribution?.salesRepUserId ?? null, commissionId: commissionId ?? null } });
    return { id: contractId, commissionId };
  }),

  updateCustomerContract: protectedProcedure.input(contractInput.extend({ contractId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    if (input.endDate && input.startDate && input.endDate < input.startDate) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ انتهاء العقد يجب أن يكون بعد تاريخ البداية." });
    const [contract] = await db.select({ id: customerContracts.id }).from(customerContracts).where(and(eq(customerContracts.id, input.contractId), eq(customerContracts.tenantId, input.tenantId), eq(customerContracts.companyId, input.companyId), eq(customerContracts.customerId, input.customerId))).limit(1);
    if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "العقد غير موجود ضمن العميل الحالي." });
    if (input.documentId) {
      const [document] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId), eq(documents.classification, "contract"))).limit(1);
      if (!document) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المستند المحدد ليس عقداً محفوظاً للشركة الحالية." });
    }
    await db.update(customerContracts).set({ contractNumber: input.contractNumber, title: input.title, status: input.status, startDate: input.startDate ? new Date(input.startDate) : null, endDate: input.endDate ? new Date(input.endDate) : null, contractValue: input.contractValue, documentId: input.documentId ?? null, notes: input.notes }).where(eq(customerContracts.id, input.contractId));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "customer.contract_updated", entityType: "customer_contract", entityId: input.contractId, newValue: { customerId: input.customerId, contractNumber: input.contractNumber, status: input.status, contractValue: input.contractValue } });
    return { id: input.contractId };
  }),

  createService: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), nameAr: z.string().min(2).max(255), unitPrice: money.optional().default("0"), description: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, salesQuotationRoles);
    await ensureDefaultChartOfAccounts(db, input.tenantId, input.companyId);
    const revenue = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId), eq(accounts.code, "4100"))).limit(1);
    if (!revenue[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أكمل تهيئة دليل الحسابات أولاً." });
    const result = await db.insert(productsServices).values({ tenantId: input.tenantId, companyId: input.companyId, kind: "service", nameAr: input.nameAr, description: input.description, unitPrice: input.unitPrice, revenueAccountId: revenue[0].id });
    return { id: Number(result[0].insertId) };
  }),

  createQuotation: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), customerContactId: z.number().int().positive().optional(), salesOwnerUserId: z.number().int().positive().optional(), quoteNumber: z.string().min(3).max(64).optional(), issueDate: z.string().regex(isoDatePattern), expiryDate: z.string().regex(isoDatePattern).optional(), scopeOfWork: z.string().max(4000).optional(), paymentTerms: z.string().max(4000).optional(), lines: z.array(salesLine).min(1) })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId);
    const db = scope.db;
    const effectiveSalesOwnerUserId = scope.roleCode === "sales_rep" ? ctx.user.id : input.salesOwnerUserId;
    if (scope.roleCode === "sales_rep" && input.salesOwnerUserId && input.salesOwnerUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "ممثل المبيعات لا يستطيع إصدار عرض باسم ممثل آخر." });
    const totals = calculateInvoiceTotals(input.lines);
    const [customer] = await db.select({ id: customers.id, salesOwnerUserId: customers.salesOwnerUserId }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId), eq(customers.isActive, true), scopedSalesOwner(scope.roleCode, ctx.user.id, customers.salesOwnerUserId))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود أو غير نشط ضمن الشركة الحالية." });
    if (input.customerContactId) {
      const [contact] = await db.select({ id: customerContacts.id }).from(customerContacts).where(and(eq(customerContacts.id, input.customerContactId), eq(customerContacts.customerId, input.customerId), eq(customerContacts.tenantId, input.tenantId), eq(customerContacts.companyId, input.companyId), eq(customerContacts.isActive, true))).limit(1);
      if (!contact) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "جهة الاتصال المختارة لا تتبع للعميل الحالي أو غير نشطة." });
    }
    return db.transaction(async (tx) => {
      const issueDate = new Date(input.issueDate); const quoteNumber = await reserveDocumentNumber(tx, { tenantId: input.tenantId, companyId: input.companyId, type: "quotation", issueDate });
      const salesOwnerUserId = effectiveSalesOwnerUserId ?? customer.salesOwnerUserId ?? undefined;
      const result = await tx.insert(quotations).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, customerContactId: input.customerContactId, salesOwnerUserId, quoteNumber, issueDate, expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined, scopeOfWork: input.scopeOfWork, paymentTerms: input.paymentTerms, subtotal: totals.subtotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal, createdByUserId: ctx.user.id });
      const quotationId = Number(result[0].insertId);
      await tx.insert(quotationLines).values(input.lines.map((line, index) => ({ tenantId: input.tenantId, quotationId, productServiceId: line.productServiceId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: line.discountAmount, taxRate: String(line.taxRateBps / 100), lineTotal: calculateInvoiceTotals([line]).grandTotal, sortOrder: index })));
      const grossValue = Number(totals.subtotal) + Number(totals.discountTotal);
      const discountRate = grossValue > 0 ? Number(totals.discountTotal) / grossValue : 0;
      if (scope.roleCode === "sales_rep" && discountRate > 0.10) {
        await tx.insert(approvalRequests).values({ tenantId: input.tenantId, companyId: input.companyId, documentType: "quotation_discount", documentId: quotationId, requestedByUserId: ctx.user.id, amount: totals.discountTotal, reason: `خصم بنسبة ${(discountRate * 100).toFixed(2)}٪ يتجاوز الحد الافتراضي لممثل المبيعات.` });
      }
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "quotation.created", entityType: "quotation", entityId: quotationId, newValue: { quoteNumber, totals, discountApprovalRequired: scope.roleCode === "sales_rep" && discountRate > 0.10, customerContactId: input.customerContactId, salesOwnerUserId, scopeOfWork: input.scopeOfWork, paymentTerms: input.paymentTerms } });
      return { id: quotationId, quoteNumber, totals };
    });
  }),

  convertQuotationToDraft: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), quotationId: z.number().int().positive(), invoiceNumber: z.string().min(3).max(64).optional(), issueDate: z.string().regex(isoDatePattern), invoiceType: z.enum(["standard", "simplified"]).default("standard") })).mutation(async ({ ctx, input }) => {
    const scope = await accessSalesScope(ctx.user.id, input.tenantId, input.companyId, invoiceIssueRoles);
    const db = scope.db;
    await ensureDefaultChartOfAccounts(db, input.tenantId, input.companyId);
    const [quote] = await db.select().from(quotations).where(and(eq(quotations.id, input.quotationId), eq(quotations.tenantId, input.tenantId), eq(quotations.companyId, input.companyId), scopedSalesOwner(scope.roleCode, ctx.user.id, quotations.salesOwnerUserId))).limit(1);
    if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "عرض السعر غير موجود ضمن الشركة الحالية." });
    if (quote.status === "converted") throw new TRPCError({ code: "CONFLICT", message: "تم تحويل عرض السعر إلى فاتورة مسبقاً." });
    if (quote.status !== "accepted") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تحويل العرض إلى فاتورة قبل موافقة العميل من بوابة العميل." });
    const quoteLines = await db.select().from(quotationLines).where(and(eq(quotationLines.tenantId, input.tenantId), eq(quotationLines.quotationId, quote.id)));
    if (quoteLines.length === 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "عرض السعر لا يحتوي على بنود قابلة للتحويل." });
    const [revenue] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId), eq(accounts.code, "4100"))).limit(1);
    if (!revenue) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "تمت تهيئة دليل الحسابات تلقائياً، لكن حساب إيرادات الخدمات غير متاح. افتح دليل الحسابات ثم أعد المحاولة." });
    return db.transaction(async (tx) => {
      const issueDate = new Date(input.issueDate); const invoiceNumber = await reserveDocumentNumber(tx, { tenantId: input.tenantId, companyId: input.companyId, type: "invoice", issueDate });
      const [customer] = await tx.select({ paymentTermsDays: customers.paymentTermsDays }).from(customers).where(and(eq(customers.id, quote.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId))).limit(1);
      const dueDate = new Date(issueDate); dueDate.setUTCDate(dueDate.getUTCDate() + (customer?.paymentTermsDays ?? 30));
      const invoiceResult = await tx.insert(invoices).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: quote.customerId, quotationId: quote.id, invoiceNumber, invoiceType: input.invoiceType, status: "draft", issueDate, dueDate, scopeOfWork: quote.scopeOfWork, paymentTerms: quote.paymentTerms, subtotal: quote.subtotal, discountTotal: "0.000000", taxTotal: quote.taxTotal, grandTotal: quote.grandTotal, createdByUserId: ctx.user.id });
      const invoiceId = Number(invoiceResult[0].insertId);
      await tx.insert(invoiceLines).values(quoteLines.map((line, index) => ({ tenantId: input.tenantId, invoiceId, productServiceId: line.productServiceId, revenueAccountId: revenue.id, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: line.discountAmount, taxableAmount: line.lineTotal, taxRate: line.taxRate, taxAmount: "0.000000", lineTotal: line.lineTotal, sortOrder: index })));
      const quoteUpdate = await tx.update(quotations).set({ status: "converted" }).where(and(eq(quotations.id, quote.id), eq(quotations.status, "accepted")));
      if (Number(quoteUpdate[0]?.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "تغيرت حالة عرض السعر أثناء التحويل؛ أعد تحميل الصفحة ثم حاول مرة أخرى." });
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "quotation.converted", entityType: "quotation", entityId: quote.id, newValue: { invoiceId, invoiceNumber } });
      return { invoiceId, invoiceNumber, status: "draft" as const };
    });
  }),

  issueDraftInvoice: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), invoiceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, invoiceIssueRoles);
    const [company] = await db.select().from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company || company.status !== "active") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب إكمال إعداد الشركة قبل إصدار الفواتير." });
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId))).limit(1);
    if (!invoice || invoice.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الفاتورة غير متاحة للإصدار؛ يجب أن تكون في حالة مسودة." });
    const draftLines = await db.select().from(invoiceLines).where(and(eq(invoiceLines.tenantId, input.tenantId), eq(invoiceLines.invoiceId, invoice.id))).orderBy(invoiceLines.sortOrder);
    const reviewLines = draftLines.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: line.discountAmount, taxRateBps: Math.round(Number(line.taxRate) * 100) }));
    const totals = calculateInvoiceTotals(reviewLines);
    const preCheck = preIssueStructuralCheck({ sellerTaxNumber: company.vatNumber ?? undefined, invoiceNumber: invoice.invoiceNumber, invoiceType: invoice.invoiceType, lines: reviewLines });
    if (!preCheck.canIssue) throw new TRPCError({ code: "PRECONDITION_FAILED", message: preCheck.issues.map((issue) => issue.message).join(" ") });
    const rulesetId = await ensureRuleset(db, input.tenantId);
    await ensureDefaultChartOfAccounts(db, input.tenantId, input.companyId);
    const [period] = await db.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId), eq(fiscalPeriods.status, "open"))).limit(1);
    if (!period) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إصدار الفاتورة لأن الشركة لا تملك فترة مالية مفتوحة. افتح أو أنشئ فترة مالية من «إعدادات الشركة» ثم أعد المحاولة." });
    const accountRows = await db.select().from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId)));
    const accountByCode = new Map(accountRows.map((account) => [account.code, account]));
    const receivable = accountByCode.get("1200"); const revenue = accountByCode.get("4100"); const vatPayable = accountByCode.get("2200");
    if (!receivable || !revenue || !vatPayable) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "دليل الحسابات لا يحتوي حسابات العملاء والإيراد والضريبة المطلوبة." });
    return db.transaction(async (tx) => {
      const complianceResult = await tx.insert(complianceChecks).values({ tenantId: input.tenantId, companyId: input.companyId, invoiceId: invoice.id, rulesetId, score: preCheck.score, hasCriticalErrors: false, resultJson: preCheck, createdByUserId: ctx.user.id });
      const complianceCheckId = Number(complianceResult[0].insertId);
      const invoiceUpdate = await tx.update(invoices).set({ status: "approved", issuedAt: new Date(), complianceCheckId, subtotal: totals.subtotal, discountTotal: totals.discountTotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal }).where(and(eq(invoices.id, invoice.id), eq(invoices.status, "draft")));
      if (Number(invoiceUpdate[0]?.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "تغيرت حالة الفاتورة أثناء الإصدار؛ أعد تحميلها ثم حاول مرة أخرى." });
      for (const [index, line] of draftLines.entries()) {
        const lineTotals = calculateInvoiceTotals([reviewLines[index]]);
        await tx.update(invoiceLines).set({ revenueAccountId: revenue.id, taxableAmount: lineTotals.taxableTotal, taxAmount: lineTotals.taxTotal, lineTotal: lineTotals.grandTotal }).where(eq(invoiceLines.id, line.id));
      }
      const entryResult = await tx.insert(journalEntries).values({ tenantId: input.tenantId, companyId: input.companyId, fiscalPeriodId: period.id, entryNumber: `JE-${invoice.invoiceNumber}`, entryDate: invoice.issueDate, status: "posted", sourceType: "invoice", sourceId: invoice.id, description: `ترحيل فاتورة ${invoice.invoiceNumber}`, debitTotal: totals.grandTotal, creditTotal: totals.grandTotal, createdByUserId: ctx.user.id, postedByUserId: ctx.user.id, postedAt: new Date() });
      const journalEntryId = Number(entryResult[0].insertId);
      const journalLinesToInsert = [{ tenantId: input.tenantId, journalEntryId, accountId: receivable.id, customerId: invoice.customerId, debit: totals.grandTotal, credit: "0.000000", description: `ذمم مدينة — ${invoice.invoiceNumber}`, lineOrder: 1 }, { tenantId: input.tenantId, journalEntryId, accountId: revenue.id, credit: totals.taxableTotal, debit: "0.000000", description: `إيراد خدمات — ${invoice.invoiceNumber}`, lineOrder: 2 }];
      if (totals.taxTotal !== "0.000000") journalLinesToInsert.push({ tenantId: input.tenantId, journalEntryId, accountId: vatPayable.id, credit: totals.taxTotal, debit: "0.000000", description: `ضريبة مخرجات — ${invoice.invoiceNumber}`, lineOrder: 3 });
      await tx.insert(journalLines).values(journalLinesToInsert);
      await tx.insert(zatcaSubmissions).values({ tenantId: input.tenantId, companyId: input.companyId, invoiceId: invoice.id, rulesetId, operation: invoice.invoiceType === "simplified" ? "reporting" : "clearance", status: "queued", idempotencyKey: `zatca-${invoice.invoiceNumber}` });
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "invoice.draft_issued", entityType: "invoice", entityId: invoice.id, newValue: { invoiceNumber: invoice.invoiceNumber, totals, journalEntryId, complianceCheckId } });
      await tx.insert(outboxEvents).values({ tenantId: input.tenantId, eventType: "invoice.approved", aggregateType: "invoice", aggregateId: invoice.id, payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }, idempotencyKey: `invoice-approved-${invoice.invoiceNumber}` });
      return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, journalEntryId, totals, compliance: preCheck };
    });
  }),

  createAndIssueInvoice: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), invoiceNumber: z.string().min(3).max(64).optional(), invoiceType: z.enum(["standard", "simplified"]), issueDate: z.string().regex(isoDatePattern), dueDate: z.string().regex(isoDatePattern).optional(), scopeOfWork: z.string().max(4000).optional(), paymentTerms: z.string().max(4000).optional(), lines: z.array(salesLine).min(1) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId, invoiceIssueRoles);
    const [company] = await db.select().from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company || company.status !== "active") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب إكمال إعداد الشركة قبل إصدار الفواتير." });
    const totals = calculateInvoiceTotals(input.lines);
    const rulesetId = await ensureRuleset(db, input.tenantId);
    await ensureDefaultChartOfAccounts(db, input.tenantId, input.companyId);
    const [period] = await db.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId), eq(fiscalPeriods.status, "open"))).limit(1);
    if (!period) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إصدار الفاتورة لأن الشركة لا تملك فترة مالية مفتوحة. افتح أو أنشئ فترة مالية من «إعدادات الشركة» ثم أعد المحاولة." });
    const accountRows = await db.select().from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId)));
    const accountByCode = new Map(accountRows.map((account) => [account.code, account]));
    const receivable = accountByCode.get("1200"); const revenue = accountByCode.get("4100"); const vatPayable = accountByCode.get("2200");
    if (!receivable || !revenue || !vatPayable) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "دليل الحسابات لا يحتوي حسابات العملاء والإيراد والضريبة المطلوبة." });
    return db.transaction(async (tx) => {
      const issueDate = new Date(input.issueDate); const invoiceNumber = await reserveDocumentNumber(tx, { tenantId: input.tenantId, companyId: input.companyId, type: "invoice", issueDate });
      const preCheck = preIssueStructuralCheck({ sellerTaxNumber: company.vatNumber ?? undefined, invoiceNumber, invoiceType: input.invoiceType, lines: input.lines });
      if (!preCheck.canIssue) throw new TRPCError({ code: "PRECONDITION_FAILED", message: preCheck.issues.map((issue) => issue.message).join(" ") });
      const invoiceResult = await tx.insert(invoices).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, invoiceNumber, invoiceType: input.invoiceType, status: "approved", issueDate, dueDate: input.dueDate ? new Date(input.dueDate) : undefined, scopeOfWork: input.scopeOfWork, paymentTerms: input.paymentTerms, subtotal: totals.subtotal, discountTotal: totals.discountTotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal, createdByUserId: ctx.user.id, issuedAt: new Date() });
      const invoiceId = Number(invoiceResult[0].insertId);
      const complianceResult = await tx.insert(complianceChecks).values({ tenantId: input.tenantId, companyId: input.companyId, invoiceId, rulesetId, score: preCheck.score, hasCriticalErrors: false, resultJson: preCheck, createdByUserId: ctx.user.id });
      const complianceCheckId = Number(complianceResult[0].insertId);
      await tx.update(invoices).set({ complianceCheckId }).where(eq(invoices.id, invoiceId));
      await tx.insert(invoiceLines).values(input.lines.map((line, index) => { const lineTotals = calculateInvoiceTotals([line]); return { tenantId: input.tenantId, invoiceId, productServiceId: line.productServiceId, revenueAccountId: revenue.id, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: line.discountAmount, taxableAmount: lineTotals.taxableTotal, taxRate: String(line.taxRateBps / 100), taxAmount: lineTotals.taxTotal, lineTotal: lineTotals.grandTotal, sortOrder: index }; }));
      const entryResult = await tx.insert(journalEntries).values({ tenantId: input.tenantId, companyId: input.companyId, fiscalPeriodId: period.id, entryNumber: `JE-${invoiceNumber}`, entryDate: issueDate, status: "posted", sourceType: "invoice", sourceId: invoiceId, description: `ترحيل فاتورة ${invoiceNumber}`, debitTotal: totals.grandTotal, creditTotal: totals.grandTotal, createdByUserId: ctx.user.id, postedByUserId: ctx.user.id, postedAt: new Date() });
      const journalEntryId = Number(entryResult[0].insertId);
      const lines = [{ tenantId: input.tenantId, journalEntryId, accountId: receivable.id, customerId: input.customerId, debit: totals.grandTotal, credit: "0.000000", description: `ذمم مدينة — ${invoiceNumber}`, lineOrder: 1 }, { tenantId: input.tenantId, journalEntryId, accountId: revenue.id, credit: totals.taxableTotal, debit: "0.000000", description: `إيراد خدمات — ${invoiceNumber}`, lineOrder: 2 }];
      if (totals.taxTotal !== "0.000000") lines.push({ tenantId: input.tenantId, journalEntryId, accountId: vatPayable.id, credit: totals.taxTotal, debit: "0.000000", description: `ضريبة مخرجات — ${invoiceNumber}`, lineOrder: 3 });
      await tx.insert(journalLines).values(lines);
      await tx.insert(zatcaSubmissions).values({ tenantId: input.tenantId, companyId: input.companyId, invoiceId, rulesetId, operation: input.invoiceType === "simplified" ? "reporting" : "clearance", status: "queued", idempotencyKey: `zatca-${invoiceNumber}` });
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "invoice.issued", entityType: "invoice", entityId: invoiceId, newValue: { invoiceNumber, totals, journalEntryId, scopeOfWork: input.scopeOfWork, paymentTerms: input.paymentTerms } });
      await tx.insert(outboxEvents).values({ tenantId: input.tenantId, eventType: "invoice.approved", aggregateType: "invoice", aggregateId: invoiceId, payload: { invoiceId, invoiceNumber }, idempotencyKey: `invoice-approved-${invoiceNumber}` });
      return { invoiceId, invoiceNumber, journalEntryId, totals, compliance: preCheck };
    });
  }),
});
