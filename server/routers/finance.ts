import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { accounts, appRoles, approvalRequests, branches, companies, companyBranding, costCenters, customers, documentNumberingRules, fiscalPeriods, invoicingPreferences, journalEntries, onboardingImportBatches, onboardingSessions, productsServices, projects, taxPeriods, taxProfiles, tenants, tenantUsers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { calculateInvoiceTotals, preIssueStructuralCheck, validateJournalEntry } from "../finance/invariants";
import { createFiscalPeriodName, defaultChartOfAccounts } from "../finance/setup";
import { ensureDefaultChartOfAccounts } from "../finance/ensureChartOfAccounts";
import { createWorkspaceIdentity } from "../finance/workspaceIdentity";
import { assertAccountParentAllowed } from "../finance/chartOfAccounts";
import { protectedProcedure, router } from "../_core/trpc";
import { assertJournalMutable } from "../finance/guards";
import { canTransitionVatPeriodStatus } from "../../shared/vatPeriodStatus";
import { appendAuditLog } from "../finance/auditLog";
import { storagePut } from "../storage";
import { canAdministerFinance } from "../finance/roleAccess";

const money = z.string().regex(/^\d+(\.\d{1,6})?$/, "صيغة المبلغ يجب أن تكون عشرية حتى ست منازل.");
const invoiceLine = z.object({ quantity: money, unitPrice: money, discountAmount: money.default("0"), taxRateBps: z.number().int().min(0).max(10000) });
const onboardingStepCodes = ["welcome", "company", "legal", "financial", "branches", "team", "invoicing", "zatca", "import", "review", "go_live"] as const;
const onboardingStepLabels: Record<(typeof onboardingStepCodes)[number], string> = { welcome: "الترحيب", company: "بيانات الشركة", legal: "المعلومات القانونية", financial: "الإعداد المالي", branches: "الفروع", team: "المستخدمون والأدوار", invoicing: "الفوترة", zatca: "ZATCA", import: "استيراد البيانات", review: "المراجعة", go_live: "بدء التشغيل" };

async function requireTenantMembership(userId: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const membership = await db.select().from(tenantUsers).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.status, "active"))).limit(1);
  if (!membership[0]) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية فعالة في الشركة المطلوبة." });
  return { db, membership: membership[0] };
}

async function requireFinanceAdministrator(userId: number, tenantId: number, companyId: number) {
  const { db, membership } = await requireTenantMembership(userId, tenantId);
  const [role] = await db.select({ code: appRoles.code }).from(appRoles).where(eq(appRoles.id, Number(membership.roleId))).limit(1);
  const [platformUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!canAdministerFinance(role?.code, platformUser?.role)) throw new TRPCError({ code: "FORBIDDEN", message: "هذه العملية المالية متاحة للمدير المالي ورئيس الحسابات أو مسؤول الشركة فقط." });
  if (membership.companyId !== companyId) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك وصولاً إلى الشركة المطلوبة." });
  return { db, membership, roleCode: role.code };
}

async function assertNotExternalAuditor(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, tenantId: number, companyId: number) {
  const [member] = await db.select({ roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (member?.roleCode === "external_auditor") throw new TRPCError({ code: "FORBIDDEN", message: "المراجع الخارجي يملك حق الاطلاع والملاحظة وطلب إعادة الفتح فقط، ولا يمكنه تعديل الإقفال." });
}

export const financeRouter = router({
  chartOfAccounts: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    return db.select().from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId))).orderBy(accounts.code);
  }),

  createAccount: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), code: z.string().min(1).max(32).regex(/^[0-9A-Za-z-]+$/), nameAr: z.string().min(2).max(255), nameEn: z.string().max(255).optional(), accountType: z.enum(["asset", "liability", "equity", "revenue", "cost_of_revenue", "expense", "other_income", "other_expense"]), normalBalance: z.enum(["debit", "credit"]), parentId: z.number().int().positive().optional(), isPosting: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireFinanceAdministrator(ctx.user.id, input.tenantId, input.companyId);
    const existing = await db.select({ id: accounts.id, parentId: accounts.parentId, accountType: accounts.accountType }).from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId)));
    try { assertAccountParentAllowed(existing, undefined, input.parentId, input.accountType); } catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "تعذر التحقق من الحساب الأب." }); }
    const result = await db.insert(accounts).values({ ...input, isActive: true });
    return { id: Number(result[0].insertId) };
  }),

  updateAccount: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), accountId: z.number().int().positive(), nameAr: z.string().min(2).max(255), nameEn: z.string().max(255).optional(), parentId: z.number().int().positive().nullable().optional(), isPosting: z.boolean(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireFinanceAdministrator(ctx.user.id, input.tenantId, input.companyId);
    const existing = await db.select({ id: accounts.id, parentId: accounts.parentId, accountType: accounts.accountType }).from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId)));
    const account = existing.find((item) => item.id === input.accountId);
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود ضمن الشركة." });
    const nextParentId = input.parentId === null ? undefined : input.parentId;
    try { assertAccountParentAllowed(existing, account.id, nextParentId, account.accountType); } catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "تعذر التحقق من الحساب الأب." }); }
    await db.update(accounts).set({ nameAr: input.nameAr, nameEn: input.nameEn, parentId: input.parentId ?? null, isPosting: input.isPosting, isActive: input.isActive }).where(eq(accounts.id, account.id));
    return { updated: true };
  }),

  updateDraftJournalDescription: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), journalEntryId: z.number().int().positive(), description: z.string().min(2).max(500) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, input.journalEntryId), eq(journalEntries.tenantId, input.tenantId), eq(journalEntries.companyId, input.companyId))).limit(1);
    if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "القيد غير موجود ضمن الشركة." });
    try { assertJournalMutable(entry.status); } catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "القيد غير قابل للتعديل." }); }
    await db.update(journalEntries).set({ description: input.description }).where(eq(journalEntries.id, entry.id));
    return { updated: true };
  }),
  listMyWorkspaces: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    return db.select({
      membership: tenantUsers,
      role: appRoles,
      tenant: tenants,
      company: companies,
    }).from(tenantUsers)
      .leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id))
      .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
      .leftJoin(companies, eq(tenantUsers.companyId, companies.id))
      .where(and(eq(tenantUsers.userId, ctx.user.id), eq(tenantUsers.status, "active")));
  }),

  workspace: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db, membership } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const company = membership.companyId ? await db.select().from(companies).where(and(eq(companies.id, membership.companyId), eq(companies.tenantId, input.tenantId))).limit(1) : [];
    return { membership, company: company[0] ?? null };
  }),

  getCompanyBranding: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [branding] = await db.select().from(companyBranding).where(and(eq(companyBranding.tenantId, input.tenantId), eq(companyBranding.companyId, input.companyId))).limit(1);
    return branding ?? { tenantId: input.tenantId, companyId: input.companyId, displayNameAr: null, displayNameEn: null, logoUrl: "/manus-storage/consedra-logo-wide_562a1e92.jpg", faviconUrl: "/manus-storage/consedra-logo-square_12f98105.jpg", primaryColor: "#0B3D3A", accentColor: "#4A82C4", surfaceColor: "#F6F7F4" };
  }),

  uploadCompanyBrandingAsset: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), kind: z.enum(["logo", "favicon"]), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), dataBase64: z.string().min(1).max(7000000) })).mutation(async ({ ctx, input }) => {
    const { db, membership } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [role] = await db.select({ code: appRoles.code }).from(appRoles).where(eq(appRoles.id, Number(membership.roleId))).limit(1);
    if (!role || !["company_admin", "super_admin", "general_manager"].includes(role.code)) throw new TRPCError({ code: "FORBIDDEN", message: "رفع هوية الشركة متاح لمسؤول الشركة والإدارة العليا فقط." });
    const [company] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "الشركة غير موجودة في مساحة العمل الحالية." });
    const buffer = Buffer.from(input.dataBase64, "base64");
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "حجم الشعار يجب ألا يتجاوز 5 ميغابايت." });
    const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
    const uploaded = await storagePut(`branding/${input.tenantId}/${input.companyId}/${input.kind}.${extension}`, buffer, input.mimeType);
    return { ...uploaded, kind: input.kind } as const;
  }),

  saveCompanyBranding: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), displayNameAr: z.string().trim().max(255).optional(), displayNameEn: z.string().trim().max(255).optional(), logoUrl: z.string().trim().url().or(z.string().startsWith("/manus-storage/")).optional(), faviconUrl: z.string().trim().url().or(z.string().startsWith("/manus-storage/")).optional(), primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), surfaceColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })).mutation(async ({ ctx, input }) => {
    const { db, membership } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [role] = await db.select({ code: appRoles.code }).from(appRoles).where(eq(appRoles.id, Number(membership.roleId))).limit(1);
    if (!role || !["company_admin", "super_admin", "general_manager"].includes(role.code)) throw new TRPCError({ code: "FORBIDDEN", message: "تعديل هوية الشركة متاح لمسؤول الشركة والإدارة العليا فقط." });
    const [company] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "الشركة غير موجودة في مساحة العمل الحالية." });
    const existing = await db.select({ id: companyBranding.id }).from(companyBranding).where(and(eq(companyBranding.tenantId, input.tenantId), eq(companyBranding.companyId, input.companyId))).limit(1);
    const values = { tenantId: input.tenantId, companyId: input.companyId, displayNameAr: input.displayNameAr || null, displayNameEn: input.displayNameEn || null, logoUrl: input.logoUrl || null, faviconUrl: input.faviconUrl || null, primaryColor: input.primaryColor, accentColor: input.accentColor, surfaceColor: input.surfaceColor };
    if (existing[0]) await db.update(companyBranding).set(values).where(eq(companyBranding.id, existing[0].id)); else await db.insert(companyBranding).values(values);
    return { saved: true } as const;
  }),

  bootstrapWorkspace: protectedProcedure.input(z.object({ vatNumber: z.string().regex(/^\d{15}$/, "الرقم الضريبي السعودي يجب أن يتكون من 15 رقماً."), legalName: z.string().min(2).max(255), legalNameAr: z.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    const identity = createWorkspaceIdentity(input.vatNumber);
    const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, identity.slug)).limit(1);
    if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "هذه الشركة مسجلة مسبقاً بالرقم الضريبي نفسه." });

    return db.transaction(async (tx) => {
      const tenantResult = await tx.insert(tenants).values({ slug: identity.slug, legalName: input.legalName, status: "active", planCode: "internal" });
      const tenantId = Number(tenantResult[0].insertId);
      const companyResult = await tx.insert(companies).values({ tenantId, legalNameAr: input.legalNameAr, vatNumber: input.vatNumber, status: "draft" });
      const companyId = Number(companyResult[0].insertId);
      const roleResult = await tx.insert(appRoles).values({ tenantId, code: "company_admin", nameAr: "مسؤول الشركة", isSystem: true });
      const roleId = Number(roleResult[0].insertId);
      await tx.insert(tenantUsers).values({ tenantId, userId: ctx.user.id, companyId, roleId, status: "active" });
      await tx.insert(onboardingSessions).values({ tenantId, companyId, userId: ctx.user.id, currentStep: "welcome", status: "active", percent: 0, answers: {} });
      return { tenantId, companyId, roleId };
    });
  }),

  configureCompany: protectedProcedure.input(z.object({
    tenantId: z.number().int().positive(),
    companyId: z.number().int().positive(),
    vatNumber: z.string().min(5).max(32).optional(),
    city: z.string().min(2).max(128),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const company = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company[0]) throw new TRPCError({ code: "NOT_FOUND", message: "الشركة غير موجودة في مساحة العمل المحددة." });
    return db.transaction(async (tx) => {
      await tx.update(companies).set({ vatNumber: input.vatNumber, city: input.city, fiscalYearStartMonth: input.fiscalYearStartMonth, status: "active" }).where(eq(companies.id, input.companyId));
      const periodName = createFiscalPeriodName(input.periodStart, input.periodEnd);
      const periodExisting = await tx.select({ id: fiscalPeriods.id }).from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId), eq(fiscalPeriods.name, periodName))).limit(1);
      if (!periodExisting[0]) await tx.insert(fiscalPeriods).values({ tenantId: input.tenantId, companyId: input.companyId, name: periodName, startDate: new Date(input.periodStart), endDate: new Date(input.periodEnd), status: "open" });
      const centerExisting = await tx.select({ id: costCenters.id }).from(costCenters).where(and(eq(costCenters.tenantId, input.tenantId), eq(costCenters.companyId, input.companyId), eq(costCenters.code, "ADMIN"))).limit(1);
      if (!centerExisting[0]) await tx.insert(costCenters).values({ tenantId: input.tenantId, companyId: input.companyId, code: "ADMIN", nameAr: "الإدارة" });
      const projectExisting = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.tenantId, input.tenantId), eq(projects.companyId, input.companyId), eq(projects.code, "GENERAL"))).limit(1);
      if (!projectExisting[0]) await tx.insert(projects).values({ tenantId: input.tenantId, companyId: input.companyId, code: "GENERAL", nameAr: "العمليات العامة" });
      const accountRows = await tx.select({ code: accounts.code }).from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId)));
      const existingCodes = new Set(accountRows.map((account) => account.code));
      const missing = defaultChartOfAccounts.filter((account) => !existingCodes.has(account.code));
      if (missing.length > 0) await tx.insert(accounts).values(missing.map((account) => ({ ...account, tenantId: input.tenantId, companyId: input.companyId, isPosting: true, isActive: true })));
      const invoiceRule = await tx.select({ id: documentNumberingRules.id }).from(documentNumberingRules).where(and(eq(documentNumberingRules.tenantId, input.tenantId), eq(documentNumberingRules.companyId, input.companyId), eq(documentNumberingRules.documentType, "invoice"))).limit(1);
      if (!invoiceRule[0]) await tx.insert(documentNumberingRules).values({ tenantId: input.tenantId, companyId: input.companyId, documentType: "invoice", prefix: "INV-", nextNumber: 1, padding: 6 });
      const [vatProfile] = await tx.select({ id: taxProfiles.id }).from(taxProfiles).where(and(eq(taxProfiles.tenantId, input.tenantId), eq(taxProfiles.companyId, input.companyId), eq(taxProfiles.taxType, "vat"))).limit(1);
      if (!vatProfile) await tx.insert(taxProfiles).values({ tenantId: input.tenantId, companyId: input.companyId, taxType: "vat", registrationNumber: input.vatNumber, defaultRateBps: 1500, filingFrequency: "quarterly" });
      const preferences = await tx.select({ id: invoicingPreferences.id }).from(invoicingPreferences).where(and(eq(invoicingPreferences.tenantId, input.tenantId), eq(invoicingPreferences.companyId, input.companyId))).limit(1);
      if (!preferences[0]) await tx.insert(invoicingPreferences).values({ tenantId: input.tenantId, companyId: input.companyId, defaultPaymentTermsDays: 30, defaultInvoiceType: "standard" });
      return { configured: true, createdAccounts: missing.length, periodName };
    });
  }),

  onboardingGetOrCreate: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [company] = await db.select({ id: companies.id, status: companies.status, vatNumber: companies.vatNumber }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "تعذر العثور على الشركة." });
    const [openPeriod] = await db.select({ id: fiscalPeriods.id, name: fiscalPeriods.name }).from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId), eq(fiscalPeriods.status, "open"))).limit(1);
    const [vatProfile] = await db.select({ id: taxProfiles.id, registrationNumber: taxProfiles.registrationNumber }).from(taxProfiles).where(and(eq(taxProfiles.tenantId, input.tenantId), eq(taxProfiles.companyId, input.companyId), eq(taxProfiles.taxType, "vat"), eq(taxProfiles.isActive, true))).limit(1);
    const requirements = [{ code: "vat", label: "رقم أو ملف VAT فعال", complete: Boolean(company.vatNumber || vatProfile?.registrationNumber) }, { code: "fiscal_period", label: "فترة مالية مفتوحة", complete: Boolean(openPeriod) }, { code: "session", label: "جلسة التهيئة", complete: true }];
    let [session] = await db.select().from(onboardingSessions).where(and(eq(onboardingSessions.tenantId, input.tenantId), eq(onboardingSessions.companyId, input.companyId))).limit(1);
    if (!session) {
      const created = await db.insert(onboardingSessions).values({ tenantId: input.tenantId, companyId: input.companyId, userId: ctx.user.id, currentStep: "welcome", status: "active", percent: 0, answers: {} });
      [session] = await db.select().from(onboardingSessions).where(eq(onboardingSessions.id, Number(created[0].insertId))).limit(1);
    }
    return { session, requirements, steps: onboardingStepCodes.map((code) => ({ code, label: onboardingStepLabels[code], complete: code === "welcome" ? session.percent > 0 : false })), stepCodes: onboardingStepCodes };
  }),

  onboardingReadiness: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [[company], [session], [openPeriod], [vatProfile], [invoicePreferences], chartAccounts] = await Promise.all([
      db.select({ vatNumber: companies.vatNumber, legalNameAr: companies.legalNameAr, baseCurrency: companies.baseCurrency }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1),
      db.select({ percent: onboardingSessions.percent, answers: onboardingSessions.answers }).from(onboardingSessions).where(and(eq(onboardingSessions.tenantId, input.tenantId), eq(onboardingSessions.companyId, input.companyId))).limit(1),
      db.select({ id: fiscalPeriods.id }).from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId), eq(fiscalPeriods.status, "open"))).limit(1),
      db.select({ id: taxProfiles.id, registrationNumber: taxProfiles.registrationNumber }).from(taxProfiles).where(and(eq(taxProfiles.tenantId, input.tenantId), eq(taxProfiles.companyId, input.companyId), eq(taxProfiles.taxType, "vat"), eq(taxProfiles.isActive, true))).limit(1),
      db.select({ id: invoicingPreferences.id }).from(invoicingPreferences).where(and(eq(invoicingPreferences.tenantId, input.tenantId), eq(invoicingPreferences.companyId, input.companyId))).limit(1),
      db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId))).limit(1),
    ]);
    const answers = (session?.answers as Record<string, unknown> | null) ?? {};
    const tasks = [
      { code: "company_profile", title: "ملف الشركة", description: "الاسم والعملة والرقم الضريبي", complete: Boolean(company?.legalNameAr && company?.baseCurrency && (company?.vatNumber || answers.vatNumber)) },
      { code: "fiscal_period", title: "الفترة المالية", description: "فترة مالية مفتوحة للترحيل", complete: Boolean(openPeriod) },
      { code: "chart_of_accounts", title: "دليل الحسابات", description: "دليل حسابات جاهز للتخصيص", complete: chartAccounts.length > 0 },
      { code: "vat_invoicing", title: "VAT والفوترة", description: "ملف VAT وتفضيلات الفوترة", complete: Boolean(vatProfile && invoicePreferences) },
      { code: "team", title: "الفريق والصلاحيات", description: "دعوة الأدوار المطلوبة", complete: true },
    ];
    const completed = tasks.filter((task) => task.complete).length;
    const nextTask = tasks.find((task) => !task.complete);
    const estimatedMinutes = tasks.filter((task) => !task.complete).length * 15;
    return { completion: Math.round((completed / tasks.length) * 100), onboardingPercent: session?.percent ?? 0, estimatedMinutes, nextTask: nextTask ? { code: nextTask.code, title: nextTask.title } : null, tasks } as const;
  }),

  onboardingValidateZatcaConfiguration: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), environment: z.enum(["sandbox", "production"]), vatNumber: z.string().regex(/^\d{15}$/, "الرقم الضريبي يجب أن يتكون من 15 رقماً."), certificate: z.string().min(16).max(20000), privateKey: z.string().min(16).max(20000) })).mutation(async ({ ctx, input }) => {
    await requireTenantMembership(ctx.user.id, input.tenantId);
    const normalizedCertificate = input.certificate.trim();
    const normalizedPrivateKey = input.privateKey.trim();
    if (!normalizedCertificate.includes("BEGIN") || !normalizedPrivateKey.includes("BEGIN")) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الشهادة والمفتاح الخاص غير مكتملة. استخدم PEM صالحاً." });
    return { validated: true, environment: input.environment, message: "تم التحقق من الصيغة محلياً. لم يُجرَ اتصال ZATCA فعلي قبل حفظ بيانات الربط الرسمية." } as const;
  }),

  onboardingRecommendations: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [session] = await db.select({ answers: onboardingSessions.answers, percent: onboardingSessions.percent }).from(onboardingSessions).where(and(eq(onboardingSessions.tenantId, input.tenantId), eq(onboardingSessions.companyId, input.companyId))).limit(1);
    const answers = (session?.answers as Record<string, unknown> | null) ?? {};
    const size = String(answers.companySize ?? answers.employees ?? "small").toLowerCase();
    const recommendations = [
      { code: "invoice_template", priority: "high", title: "راجع قالب الفاتورة والهوية", description: "تأكد من ظهور الرقم الضريبي والباركود وبيانات الشركة قبل أول إصدار." },
      { code: "opening_balances", priority: "high", title: "أدخل الأرصدة الافتتاحية", description: "استخدم دفعة استيراد موثقة ثم راجع ميزان المراجعة قبل الترحيل." },
      { code: "sales_pipeline", priority: size.includes("medium") || Number(answers.employees) > 10 ? "medium" : "low", title: "فعّل مسار المبيعات", description: "أنشئ مراحل CRM ومهام متابعة وربطاً واضحاً بين عرض السعر والفاتورة." },
      { code: "zatca_validation", priority: "high", title: "أكمل تحقق ZATCA", description: "لا تعتبر الربط مكتملًا قبل اختبار الاتصال الفعلي وحفظ نتيجة التحقق." },
      { code: "approval_controls", priority: "medium", title: "فعّل ضوابط الموافقات", description: "استخدم Maker-Checker للفواتير والدفعات والأرصدة الافتتاحية، ثم خصص حدود الاعتماد لاحقاً من مركز القيادة التنفيذي." },
    ];
    return { percent: session?.percent ?? 0, recommendations } as const;
  }),

  onboardingSaveProgress: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), currentStep: z.enum(onboardingStepCodes), percent: z.number().int().min(0).max(100), answers: z.record(z.string(), z.unknown()).optional(), status: z.enum(["active", "paused", "completed", "abandoned"]).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [session] = await db.select({ id: onboardingSessions.id, answers: onboardingSessions.answers }).from(onboardingSessions).where(and(eq(onboardingSessions.tenantId, input.tenantId), eq(onboardingSessions.companyId, input.companyId))).limit(1);
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "جلسة التهيئة غير موجودة." });
    const mergedAnswers = { ...((session.answers as Record<string, unknown> | null) ?? {}), ...(input.answers ?? {}) };
    const vatNumber = String(mergedAnswers.vatNumber ?? "").trim();
    if (vatNumber && !/^\d{15}$/.test(vatNumber)) throw new TRPCError({ code: "BAD_REQUEST", message: "الرقم الضريبي يجب أن يتكون من 15 رقماً." });
    const periodStart = String(mergedAnswers.periodStart ?? "").trim();
    const periodEnd = String(mergedAnswers.periodEnd ?? "").trim();
    if (["review", "go_live"].includes(input.currentStep) && (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd))) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل تاريخ بداية ونهاية السنة المالية بصيغة YYYY-MM-DD." });
    await db.update(onboardingSessions).set({ currentStep: input.currentStep, percent: input.percent, status: input.status ?? "active", answers: mergedAnswers, completedAt: input.status === "completed" ? new Date() : undefined }).where(eq(onboardingSessions.id, session.id));
    const legalNameAr = String(mergedAnswers.companyNameAr ?? "").trim();
    if (legalNameAr || vatNumber || mergedAnswers.unifiedNumber || mergedAnswers.commercialRegistration || mergedAnswers.nationalAddress) await db.update(companies).set({ legalNameAr: legalNameAr || undefined, vatNumber: vatNumber || undefined, unifiedNumber: String(mergedAnswers.unifiedNumber ?? "").trim() || undefined, commercialRegistration: String(mergedAnswers.commercialRegistration ?? "").trim() || undefined, nationalAddress: String(mergedAnswers.nationalAddress ?? "").trim() || undefined, city: String(mergedAnswers.city ?? "").trim() || undefined, baseCurrency: String(mergedAnswers.currency ?? "SAR").trim() || "SAR" }).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId)));
    return { saved: true, currentStep: input.currentStep, percent: input.percent } as const;
  }),

  onboardingGoLive: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), confirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [session] = await db.select().from(onboardingSessions).where(and(eq(onboardingSessions.tenantId, input.tenantId), eq(onboardingSessions.companyId, input.companyId))).limit(1);
    if (!session) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أكمل جلسة التهيئة قبل بدء التشغيل." });
    const [company] = await db.select({ vatNumber: companies.vatNumber }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    const [openPeriod] = await db.select({ id: fiscalPeriods.id }).from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId), eq(fiscalPeriods.status, "open"))).limit(1);
    const [vatProfile] = await db.select({ registrationNumber: taxProfiles.registrationNumber }).from(taxProfiles).where(and(eq(taxProfiles.tenantId, input.tenantId), eq(taxProfiles.companyId, input.companyId), eq(taxProfiles.taxType, "vat"), eq(taxProfiles.isActive, true))).limit(1);
    if (session.percent < 80) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن بدء التشغيل قبل إكمال المتطلبات الأساسية." });
    if (!company?.vatNumber && !vatProfile?.registrationNumber) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أضف الرقم الضريبي أو فعّل ملف VAT قبل بدء التشغيل." });
    if (!openPeriod) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أنشئ فترة مالية مفتوحة قبل بدء التشغيل." });
    await db.transaction(async (tx) => {
      const [mainBranch] = await tx.select({ id: branches.id }).from(branches).where(and(eq(branches.tenantId, input.tenantId), eq(branches.companyId, input.companyId), eq(branches.code, "MAIN"))).limit(1);
      if (!mainBranch) await tx.insert(branches).values({ tenantId: input.tenantId, companyId: input.companyId, code: "MAIN", nameAr: "الإدارة الرئيسية", nameEn: "Main Administration", vatNumber: company?.vatNumber ?? null, isActive: true });
      await ensureDefaultChartOfAccounts(tx, input.tenantId, input.companyId);
      await tx.update(onboardingSessions).set({ status: "completed", currentStep: "go_live", percent: 100, completedAt: new Date() }).where(eq(onboardingSessions.id, session.id));
      await tx.update(companies).set({ status: "active" }).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId)));
    });
    return { live: true, status: "completed" } as const;
  }),

  onboardingCreateImportBatch: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), entityType: z.enum(["customers", "products_services", "opening_balances"]), sourceType: z.enum(["csv", "xlsx"]), filename: z.string().max(255).optional(), totalRows: z.number().int().min(0).default(0), validRows: z.number().int().min(0).default(0), errorCount: z.number().int().min(0).default(0), errorSummary: z.string().max(4000).optional(), payload: z.string().max(1500000).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const result = await db.insert(onboardingImportBatches).values({ ...input, userId: ctx.user.id, status: input.errorCount > 0 ? "previewed" : "uploaded" });
    return { id: Number(result[0].insertId), status: input.errorCount > 0 ? "previewed" : "uploaded" } as const;
  }),

  onboardingImportHistory: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    return db.select({ id: onboardingImportBatches.id, entityType: onboardingImportBatches.entityType, filename: onboardingImportBatches.filename, status: onboardingImportBatches.status, totalRows: onboardingImportBatches.totalRows, validRows: onboardingImportBatches.validRows, errorCount: onboardingImportBatches.errorCount, createdAt: onboardingImportBatches.createdAt }).from(onboardingImportBatches).where(and(eq(onboardingImportBatches.tenantId, input.tenantId), eq(onboardingImportBatches.companyId, input.companyId))).orderBy(onboardingImportBatches.createdAt);
  }),

  onboardingCommitImportBatch: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), batchId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [batch] = await db.select().from(onboardingImportBatches).where(and(eq(onboardingImportBatches.id, input.batchId), eq(onboardingImportBatches.tenantId, input.tenantId), eq(onboardingImportBatches.companyId, input.companyId))).limit(1);
    if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "دفعة الاستيراد غير موجودة ضمن الشركة." });
    if (batch.status === "imported") return { imported: true, count: batch.validRows } as const;
    if (batch.errorCount > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن اعتماد دفعة تحتوي على أخطاء." });
    if (batch.entityType === "opening_balances") {
      const [existingApproval] = await db.select({ id: approvalRequests.id, status: approvalRequests.status }).from(approvalRequests).where(and(eq(approvalRequests.tenantId, input.tenantId), eq(approvalRequests.companyId, input.companyId), eq(approvalRequests.documentType, "opening_balances_import"), eq(approvalRequests.documentId, batch.id), eq(approvalRequests.status, "pending"))).limit(1);
      if (existingApproval) return { imported: false, approvalRequired: true, approvalRequestId: existingApproval.id } as const;
      const approval = await db.insert(approvalRequests).values({ tenantId: input.tenantId, companyId: input.companyId, documentType: "opening_balances_import", documentId: batch.id, requestedByUserId: ctx.user.id, amount: "0", reason: `مراجعة أرصدة افتتاحية لدفعة ${batch.filename ?? batch.id}`, status: "pending" });
      await db.update(onboardingImportBatches).set({ status: "validated" }).where(eq(onboardingImportBatches.id, batch.id));
      return { imported: false, approvalRequired: true, approvalRequestId: Number(approval[0].insertId) } as const;
    }
    let rows: Array<Record<string, unknown>>;
    try { rows = JSON.parse(batch.payload ?? "[]") as Array<Record<string, unknown>>; } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "حمولة الاستيراد غير صالحة." }); }
    let importedCount = 0;
    await db.transaction(async (tx) => {
      for (const row of rows) {
        if (batch.entityType === "customers") {
          const name = String(row.name ?? row.nameAr ?? row.customerName ?? row["اسم العميل"] ?? row["اسم الشركة"] ?? "").trim();
          if (!name) continue;
          await tx.insert(customers).values({ tenantId: input.tenantId, companyId: input.companyId, name, customerType: "company", businessModel: "b2b", vatNumber: String(row.vatNumber ?? row["الرقم الضريبي"] ?? "").trim() || null, email: String(row.email ?? row["البريد الإلكتروني"] ?? "").trim() || null, phone: String(row.phone ?? row["الجوال"] ?? "").trim() || null, paymentTermsDays: Number(row.paymentTermsDays ?? 30) || 30, isActive: true });
        } else {
          const nameAr = String(row.nameAr ?? row.name ?? row.productName ?? row.serviceName ?? row["اسم الصنف"] ?? row["الخدمة"] ?? "").trim();
          if (!nameAr) continue;
          await tx.insert(productsServices).values({ tenantId: input.tenantId, companyId: input.companyId, kind: row.kind === "product" ? "product" : "service", sku: String(row.sku ?? row.code ?? "").trim() || null, nameAr, nameEn: String(row.nameEn ?? "").trim() || null, description: String(row.description ?? "").trim() || null, unit: String(row.unit ?? "وحدة").trim() || "وحدة", unitPrice: String(row.unitPrice ?? "0") || "0", isActive: true });
        }
        importedCount += 1;
      }
      await tx.update(onboardingImportBatches).set({ status: "imported", validRows: importedCount }).where(eq(onboardingImportBatches.id, batch.id));
    });
    return { imported: true, count: importedCount } as const;
  }),

  onboardingStatus: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [[company], periods, accountsRows, taxRows, [invoicePreferences], members] = await Promise.all([
      db.select().from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1),
      db.select({ id: fiscalPeriods.id }).from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId))),
      db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId))),
      db.select({ id: taxProfiles.id }).from(taxProfiles).where(and(eq(taxProfiles.tenantId, input.tenantId), eq(taxProfiles.companyId, input.companyId))),
      db.select({ id: invoicingPreferences.id }).from(invoicingPreferences).where(and(eq(invoicingPreferences.tenantId, input.tenantId), eq(invoicingPreferences.companyId, input.companyId))).limit(1),
      db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.status, "active"))),
    ]);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "تعذر العثور على الشركة." });
    const steps = [
      { code: "company", label: "بيانات الشركة والرقم الضريبي", complete: company.status === "active" && Boolean(company.vatNumber) },
      { code: "period", label: "الفترة المالية", complete: periods.length > 0 },
      { code: "accounts", label: "دليل الحسابات", complete: accountsRows.length > 0 },
      { code: "tax", label: "ملف الضريبة", complete: taxRows.length > 0 },
      { code: "invoicing", label: "إعدادات الفوترة والترقيم", complete: Boolean(invoicePreferences) },
      { code: "team", label: "الفريق والصلاحيات", complete: members.length > 0 },
    ];
    const completed = steps.filter((step) => step.complete).length;
    return { company, periodCount: periods.length, accountCount: accountsRows.length, isConfigured: company.status === "active" && periods.length > 0 && accountsRows.length > 0, steps, completed, total: steps.length, percent: Math.round((completed / steps.length) * 100), isReady: completed === steps.length };
  }),

  setupData: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const scope = and(eq(branches.tenantId, input.tenantId), eq(branches.companyId, input.companyId));
    const [branchRows, periodRows, centerRows, projectRows, ruleRows, taxProfileRows, taxPeriodRows, preferenceRows] = await Promise.all([
      db.select().from(branches).where(scope),
      db.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId))),
      db.select().from(costCenters).where(and(eq(costCenters.tenantId, input.tenantId), eq(costCenters.companyId, input.companyId))),
      db.select().from(projects).where(and(eq(projects.tenantId, input.tenantId), eq(projects.companyId, input.companyId))),
      db.select().from(documentNumberingRules).where(and(eq(documentNumberingRules.tenantId, input.tenantId), eq(documentNumberingRules.companyId, input.companyId))),
      db.select().from(taxProfiles).where(and(eq(taxProfiles.tenantId, input.tenantId), eq(taxProfiles.companyId, input.companyId))),
      db.select().from(taxPeriods).where(and(eq(taxPeriods.tenantId, input.tenantId), eq(taxPeriods.companyId, input.companyId))),
      db.select().from(invoicingPreferences).where(and(eq(invoicingPreferences.tenantId, input.tenantId), eq(invoicingPreferences.companyId, input.companyId))),
    ]);
    return { branches: branchRows, periods: periodRows, costCenters: centerRows, projects: projectRows, numberingRules: ruleRows, taxProfiles: taxProfileRows, taxPeriods: taxPeriodRows, invoicingPreferences: preferenceRows[0] ?? null };
  }),

  updateCompanyProfile: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), legalNameAr: z.string().min(2).max(255), legalNameEn: z.string().max(255).optional(), commercialRegistration: z.string().max(64).optional(), email: z.string().email().optional(), phone: z.string().max(32).optional(), city: z.string().max(128).optional(), nationalAddress: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [company] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "الشركة غير موجودة ضمن مساحة العمل." });
    await db.update(companies).set({ legalNameAr: input.legalNameAr, legalNameEn: input.legalNameEn, commercialRegistration: input.commercialRegistration, email: input.email, phone: input.phone, city: input.city, nationalAddress: input.nationalAddress }).where(eq(companies.id, input.companyId));
    return { updated: true };
  }),

  updateBranch: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), branchId: z.number().int().positive(), nameAr: z.string().min(2).max(255), nameEn: z.string().max(255).optional(), vatNumber: z.string().max(32).optional(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [branch] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, input.branchId), eq(branches.tenantId, input.tenantId), eq(branches.companyId, input.companyId))).limit(1);
    if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "الفرع غير موجود ضمن الشركة." });
    await db.update(branches).set({ nameAr: input.nameAr, nameEn: input.nameEn, vatNumber: input.vatNumber, isActive: input.isActive }).where(eq(branches.id, branch.id));
    return { updated: true };
  }),

  updateFiscalPeriod: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), periodId: z.number().int().positive(), status: z.enum(["open", "soft_locked", "hard_locked"]) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireFinanceAdministrator(ctx.user.id, input.tenantId, input.companyId);
    await assertNotExternalAuditor(db, ctx.user.id, input.tenantId, input.companyId);
    const [period] = await db.select({ id: fiscalPeriods.id, status: fiscalPeriods.status }).from(fiscalPeriods).where(and(eq(fiscalPeriods.id, input.periodId), eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.companyId, input.companyId))).limit(1);
    if (!period) throw new TRPCError({ code: "NOT_FOUND", message: "الفترة المالية غير موجودة ضمن الشركة." });
    const isLocked = input.status !== "open";
    await db.update(fiscalPeriods).set({ status: input.status, lockedByUserId: isLocked ? ctx.user.id : null, lockedAt: isLocked ? new Date() : null }).where(eq(fiscalPeriods.id, period.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "fiscal_period.status_updated", entityType: "fiscal_period", entityId: period.id, previousValue: { status: period.status }, newValue: { status: input.status } });
    return { updated: true };
  }),

  addBranch: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), code: z.string().min(1).max(32), nameAr: z.string().min(2).max(255), vatNumber: z.string().max(32).optional(), city: z.string().max(128).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const existing = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.tenantId, input.tenantId), eq(branches.companyId, input.companyId), eq(branches.code, input.code))).limit(1);
    if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "رمز الفرع مستخدم في هذه الشركة." });
    const result = await db.insert(branches).values(input);
    return { id: Number(result[0].insertId) };
  }),

  addFiscalPeriod: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), name: z.string().min(4).max(64), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireFinanceAdministrator(ctx.user.id, input.tenantId, input.companyId);
    const result = await db.insert(fiscalPeriods).values({ ...input, startDate: new Date(input.startDate), endDate: new Date(input.endDate), status: "open" });
    return { id: Number(result[0].insertId) };
  }),

  addCostCenter: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), code: z.string().min(1).max(32), nameAr: z.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireFinanceAdministrator(ctx.user.id, input.tenantId, input.companyId);
    const result = await db.insert(costCenters).values(input);
    return { id: Number(result[0].insertId) };
  }),

  addProject: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), code: z.string().min(1).max(32), nameAr: z.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const result = await db.insert(projects).values(input);
    return { id: Number(result[0].insertId) };
  }),

  updateCostCenter: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), costCenterId: z.number().int().positive(), nameAr: z.string().min(2).max(255), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireFinanceAdministrator(ctx.user.id, input.tenantId, input.companyId);
    const [center] = await db.select({ id: costCenters.id }).from(costCenters).where(and(eq(costCenters.id, input.costCenterId), eq(costCenters.tenantId, input.tenantId), eq(costCenters.companyId, input.companyId))).limit(1);
    if (!center) throw new TRPCError({ code: "NOT_FOUND", message: "مركز التكلفة غير موجود ضمن الشركة." });
    await db.update(costCenters).set({ nameAr: input.nameAr, isActive: input.isActive }).where(eq(costCenters.id, center.id));
    return { updated: true };
  }),

  updateProject: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), projectId: z.number().int().positive(), nameAr: z.string().min(2).max(255), status: z.enum(["active", "on_hold", "closed"]) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.tenantId, input.tenantId), eq(projects.companyId, input.companyId))).limit(1);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "المشروع غير موجود ضمن الشركة." });
    await db.update(projects).set({ nameAr: input.nameAr, status: input.status }).where(eq(projects.id, project.id));
    return { updated: true };
  }),

  saveNumberingRule: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentType: z.enum(["invoice", "quotation", "credit_note", "debit_note", "journal", "payment"]), prefix: z.string().min(1).max(24), nextNumber: z.number().int().min(1), padding: z.number().int().min(3).max(12) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const existing = await db.select({ id: documentNumberingRules.id }).from(documentNumberingRules).where(and(eq(documentNumberingRules.tenantId, input.tenantId), eq(documentNumberingRules.companyId, input.companyId), eq(documentNumberingRules.documentType, input.documentType))).limit(1);
    if (existing[0]) await db.update(documentNumberingRules).set({ prefix: input.prefix, nextNumber: input.nextNumber, padding: input.padding, isActive: true }).where(eq(documentNumberingRules.id, existing[0].id));
    else await db.insert(documentNumberingRules).values(input);
    return { saved: true };
  }),

  saveTaxProfile: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), taxType: z.enum(["vat", "zakat"]), registrationNumber: z.string().max(64).optional(), defaultRateBps: z.number().int().min(0).max(10000), filingFrequency: z.enum(["monthly", "quarterly", "annual"]) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [existing] = await db.select({ id: taxProfiles.id }).from(taxProfiles).where(and(eq(taxProfiles.tenantId, input.tenantId), eq(taxProfiles.companyId, input.companyId), eq(taxProfiles.taxType, input.taxType))).limit(1);
    if (existing) await db.update(taxProfiles).set({ registrationNumber: input.registrationNumber, defaultRateBps: input.defaultRateBps, filingFrequency: input.filingFrequency, isActive: true }).where(eq(taxProfiles.id, existing.id));
    else await db.insert(taxProfiles).values(input);
    return { saved: true };
  }),

  addTaxPeriod: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), taxProfileId: z.number().int().positive(), name: z.string().min(3).max(64), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const result = await db.insert(taxPeriods).values({ ...input, startDate: new Date(input.startDate), endDate: new Date(input.endDate), status: "open" });
    return { id: Number(result[0].insertId) };
  }),

  updateTaxPeriodStatus: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), taxPeriodId: z.number().int().positive(), status: z.enum(["open", "prepared", "filed", "locked"]) })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [period] = await db.select({ id: taxPeriods.id, status: taxPeriods.status }).from(taxPeriods).where(and(eq(taxPeriods.id, input.taxPeriodId), eq(taxPeriods.tenantId, input.tenantId), eq(taxPeriods.companyId, input.companyId))).limit(1);
    if (!period) throw new TRPCError({ code: "NOT_FOUND", message: "فترة VAT غير موجودة ضمن الشركة." });
    if (!canTransitionVatPeriodStatus(period.status, input.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يسمح بتغيير حالة فترة VAT بهذا التسلسل." });
    await db.update(taxPeriods).set({ status: input.status }).where(eq(taxPeriods.id, period.id));
    return { updated: true };
  }),

  saveInvoicingPreferences: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), defaultPaymentTermsDays: z.number().int().min(0).max(365), defaultInvoiceType: z.enum(["standard", "simplified"]), footerNoteAr: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTenantMembership(ctx.user.id, input.tenantId);
    const [existing] = await db.select({ id: invoicingPreferences.id }).from(invoicingPreferences).where(and(eq(invoicingPreferences.tenantId, input.tenantId), eq(invoicingPreferences.companyId, input.companyId))).limit(1);
    if (existing) await db.update(invoicingPreferences).set({ defaultPaymentTermsDays: input.defaultPaymentTermsDays, defaultInvoiceType: input.defaultInvoiceType, footerNoteAr: input.footerNoteAr }).where(eq(invoicingPreferences.id, existing.id));
    else await db.insert(invoicingPreferences).values(input);
    return { saved: true };
  }),

  previewInvoice: protectedProcedure.input(z.object({ sellerTaxNumber: z.string().optional(), invoiceNumber: z.string().optional(), invoiceType: z.enum(["standard", "simplified", "credit_note", "debit_note"]).optional(), lines: z.array(invoiceLine) })).mutation(({ input }) => ({
    totals: calculateInvoiceTotals(input.lines),
    compliance: preIssueStructuralCheck(input),
  })),

  validateJournal: protectedProcedure.input(z.object({ lines: z.array(z.object({ debit: money, credit: money })) })).mutation(({ input }) => validateJournalEntry(input.lines)),
});
