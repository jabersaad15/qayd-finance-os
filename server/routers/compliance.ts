import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { complianceChecks, customers, documents, invoices, supplierInvoices, taxPeriods, taxProfiles, tenantUsers, vatReturnPreparations, zatcaSubmissions } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { appendAuditLog } from "../finance/auditLog";
import { summarizeVatReturn } from "../finance/vatReturn";

async function accessCompany(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const member = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member[0]) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك حق الوصول إلى هذه الشركة." });
  return db;
}

export const complianceRouter = router({
  readiness: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [profile, openPeriods, missingCustomerIdentity, invoiceFailures] = await Promise.all([
      db.select({ id: taxProfiles.id, taxType: taxProfiles.taxType, registrationNumber: taxProfiles.registrationNumber }).from(taxProfiles).where(and(eq(taxProfiles.tenantId, input.tenantId), eq(taxProfiles.companyId, input.companyId))).limit(1),
      db.select({ id: taxPeriods.id, status: taxPeriods.status, startDate: taxPeriods.startDate, endDate: taxPeriods.endDate }).from(taxPeriods).where(and(eq(taxPeriods.tenantId, input.tenantId), eq(taxPeriods.companyId, input.companyId), eq(taxPeriods.status, "open"))).orderBy(desc(taxPeriods.startDate)).limit(3),
      db.select({ count: sql<number>`count(*)` }).from(customers).where(and(eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId), sql`(${customers.vatNumber} is null or ${customers.vatNumber} = '')`)),
      db.select({ count: sql<number>`count(*)` }).from(complianceChecks).where(and(eq(complianceChecks.tenantId, input.tenantId), eq(complianceChecks.companyId, input.companyId), eq(complianceChecks.hasCriticalErrors, true))),
    ]);
    const checks = [
      { key: "tax_profile", label: "ملف VAT", passed: Boolean(profile[0]?.registrationNumber && profile[0]?.taxType === "vat") },
      { key: "open_period", label: "فترة مالية مفتوحة", passed: openPeriods.length > 0 },
      { key: "customer_identity", label: "هويات العملاء", passed: Number(missingCustomerIdentity[0]?.count ?? 0) === 0 },
      { key: "invoice_compliance", label: "فحوصات الفواتير", passed: Number(invoiceFailures[0]?.count ?? 0) === 0 },
    ];
    return { checks, score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100), profile: profile[0] ?? null, openPeriods, missingCustomerIdentity: Number(missingCustomerIdentity[0]?.count ?? 0), criticalInvoiceChecks: Number(invoiceFailures[0]?.count ?? 0) };
  }),

  vatSummary: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [summary] = await db.select({ taxableSales: sql<string>`coalesce(sum(${invoices.subtotal} - ${invoices.discountTotal}), 0)`, outputVat: sql<string>`coalesce(sum(${invoices.taxTotal}), 0)`, invoiceCount: sql<number>`count(${invoices.id})` }).from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), eq(invoices.status, "approved")));
    return { taxableSales: summary?.taxableSales ?? "0", outputVat: summary?.outputVat ?? "0", inputVat: "0.000000", netVatDue: summary?.outputVat ?? "0", invoiceCount: Number(summary?.invoiceCount ?? 0), notice: "يعرض هذا الملخص ضريبة المخرجات من الفواتير المعتمدة فقط. يلزم إدخال وتدقيق ضريبة المدخلات والمراجعة المختصة قبل الإقرار." };
  }),

  dashboard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [submissions, checks] = await Promise.all([
      db.select({ id: zatcaSubmissions.id, status: zatcaSubmissions.status, operation: zatcaSubmissions.operation, createdAt: zatcaSubmissions.createdAt, invoiceNumber: invoices.invoiceNumber }).from(zatcaSubmissions).innerJoin(invoices, eq(zatcaSubmissions.invoiceId, invoices.id)).where(and(eq(zatcaSubmissions.tenantId, input.tenantId), eq(zatcaSubmissions.companyId, input.companyId))).orderBy(desc(zatcaSubmissions.createdAt)).limit(20),
      db.select({ id: complianceChecks.id, score: complianceChecks.score, hasCriticalErrors: complianceChecks.hasCriticalErrors, invoiceId: complianceChecks.invoiceId, checkedAt: complianceChecks.checkedAt }).from(complianceChecks).where(and(eq(complianceChecks.tenantId, input.tenantId), eq(complianceChecks.companyId, input.companyId))).orderBy(desc(complianceChecks.checkedAt)).limit(20),
    ]);
    return { submissions, checks, queuedCount: submissions.filter((item) => item.status === "queued").length, failedCount: submissions.filter((item) => item.status === "failed").length, reviewCount: checks.filter((item) => item.hasCriticalErrors).length };
  }),

  vatReturnWorkspace: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [periods, preparations, zakatDocuments] = await Promise.all([
      db.select({ period: taxPeriods, profile: taxProfiles }).from(taxPeriods).innerJoin(taxProfiles, eq(taxPeriods.taxProfileId, taxProfiles.id)).where(and(eq(taxPeriods.tenantId, input.tenantId), eq(taxPeriods.companyId, input.companyId), eq(taxProfiles.taxType, "vat"))).orderBy(desc(taxPeriods.endDate)),
      db.select().from(vatReturnPreparations).where(and(eq(vatReturnPreparations.tenantId, input.tenantId), eq(vatReturnPreparations.companyId, input.companyId))).orderBy(desc(vatReturnPreparations.updatedAt)),
      db.select().from(documents).where(and(eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId), eq(documents.classification, "zakat"))).orderBy(desc(documents.createdAt)),
    ]);
    return { periods, preparations, zakatDocuments };
  }),

  prepareVatReturn: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), taxPeriodId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [period] = await db.select({ period: taxPeriods, profile: taxProfiles }).from(taxPeriods).innerJoin(taxProfiles, eq(taxPeriods.taxProfileId, taxProfiles.id)).where(and(eq(taxPeriods.id, input.taxPeriodId), eq(taxPeriods.tenantId, input.tenantId), eq(taxPeriods.companyId, input.companyId), eq(taxProfiles.taxType, "vat"))).limit(1);
    if (!period || period.period.status === "filed" || period.period.status === "locked") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إعداد إقرار لفترة غير متاحة للتحضير." });
    const [existing] = await db.select().from(vatReturnPreparations).where(and(eq(vatReturnPreparations.tenantId, input.tenantId), eq(vatReturnPreparations.companyId, input.companyId), eq(vatReturnPreparations.taxPeriodId, input.taxPeriodId))).limit(1);
    if (existing && existing.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "تعذر إعادة الحساب بعد إرسال الإقرار للمراجعة؛ أعده إلى المسودة وفق إجراء المراجعة أولاً." });
    const [sales, purchases] = await Promise.all([
      db.select({ taxableSales: sql<string>`coalesce(sum(${invoices.subtotal} - ${invoices.discountTotal}), 0)`, outputVat: sql<string>`coalesce(sum(${invoices.taxTotal}), 0)` }).from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), eq(invoices.status, "approved"), gte(invoices.issueDate, period.period.startDate), lte(invoices.issueDate, period.period.endDate))),
      db.select({ inputVat: sql<string>`coalesce(sum(${supplierInvoices.taxTotal}), 0)` }).from(supplierInvoices).where(and(eq(supplierInvoices.tenantId, input.tenantId), eq(supplierInvoices.companyId, input.companyId), eq(supplierInvoices.status, "approved"), gte(supplierInvoices.invoiceDate, period.period.startDate), lte(supplierInvoices.invoiceDate, period.period.endDate))),
    ]);
    const summary = summarizeVatReturn({ taxableSales: sales[0]?.taxableSales ?? "0.000000", outputVat: sales[0]?.outputVat ?? "0.000000", inputVat: purchases[0]?.inputVat ?? "0.000000" });
    if (existing) {
      await db.update(vatReturnPreparations).set({ ...summary, preparedByUserId: ctx.user.id }).where(eq(vatReturnPreparations.id, existing.id));
    } else {
      await db.insert(vatReturnPreparations).values({ tenantId: input.tenantId, companyId: input.companyId, taxPeriodId: input.taxPeriodId, ...summary, preparedByUserId: ctx.user.id });
    }
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "vat_return.prepared", entityType: "tax_period", entityId: input.taxPeriodId, newValue: summary });
    return summary;
  }),

  submitVatReturnForReview: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), taxPeriodId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [preparation] = await db.select().from(vatReturnPreparations).where(and(eq(vatReturnPreparations.tenantId, input.tenantId), eq(vatReturnPreparations.companyId, input.companyId), eq(vatReturnPreparations.taxPeriodId, input.taxPeriodId))).limit(1);
    if (!preparation || preparation.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم تحضير مسودة إقرار VAT قبل إرسالها للمراجعة." });
    await db.transaction(async (tx) => {
      await tx.update(vatReturnPreparations).set({ status: "under_review" }).where(eq(vatReturnPreparations.id, preparation.id));
      await tx.update(taxPeriods).set({ status: "prepared" }).where(and(eq(taxPeriods.id, input.taxPeriodId), eq(taxPeriods.tenantId, input.tenantId), eq(taxPeriods.companyId, input.companyId)));
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "vat_return.submitted_for_review", entityType: "tax_period", entityId: input.taxPeriodId });
    });
    return { submitted: true };
  }),

  reviewVatReturn: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), taxPeriodId: z.number().int().positive(), reviewNotes: z.string().min(3).max(4000) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [preparation] = await db.select().from(vatReturnPreparations).where(and(eq(vatReturnPreparations.tenantId, input.tenantId), eq(vatReturnPreparations.companyId, input.companyId), eq(vatReturnPreparations.taxPeriodId, input.taxPeriodId))).limit(1);
    if (!preparation || preparation.status !== "under_review") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم أن تكون مسودة إقرار VAT تحت المراجعة لتسجيل قرار المراجع." });
    await db.update(vatReturnPreparations).set({ status: "reviewed", reviewNotes: input.reviewNotes, reviewedByUserId: ctx.user.id, reviewedAt: new Date() }).where(eq(vatReturnPreparations.id, preparation.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "vat_return.reviewed", entityType: "tax_period", entityId: input.taxPeriodId, newValue: { reviewNotes: input.reviewNotes } });
    return { reviewed: true };
  }),
});
