import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companies, documentLinks, documents, supplierInvoiceLines, supplierInvoices, suppliers, tenantUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { calculateInvoiceTotals } from "../finance/invariants";
import { appendAuditLog } from "../finance/auditLog";
import { protectedProcedure, router } from "../_core/trpc";
import { canTransitionSupplierInvoice } from "../../shared/supplierInvoiceStatus";

const money = z.string().regex(/^\d+(\.\d{1,6})?$/);
const purchaseLine = z.object({ description: z.string().min(2).max(500), quantity: money, unitPrice: money, taxRateBps: z.number().int().min(0).max(10000), expenseAccountId: z.number().int().positive().optional(), costCenterId: z.number().int().positive().optional(), projectId: z.number().int().positive().optional() });

async function accessCompany(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const membership = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!membership[0]) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك حق الوصول إلى هذه الشركة." });
  return db;
}

export const purchasesRouter = router({
  listSuppliers: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    return db.select().from(suppliers).where(and(eq(suppliers.tenantId, input.tenantId), eq(suppliers.companyId, input.companyId), eq(suppliers.isActive, true)));
  }),

  listSupplierInvoices: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    return db.select({ invoice: supplierInvoices, supplierName: suppliers.name }).from(supplierInvoices).innerJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId)).where(and(eq(supplierInvoices.tenantId, input.tenantId), eq(supplierInvoices.companyId, input.companyId))).orderBy(supplierInvoices.createdAt);
  }),

  createSupplierInvoiceDraft: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), supplierId: z.number().int().positive(), sourceDocumentId: z.number().int().positive().optional(), supplierInvoiceNumber: z.string().min(2).max(128), invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), lines: z.array(purchaseLine).min(1) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [supplier] = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.tenantId, input.tenantId), eq(suppliers.companyId, input.companyId), eq(suppliers.isActive, true))).limit(1);
    if (!supplier) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المورد المحدد غير نشط أو لا يتبع الشركة." });
    if (input.sourceDocumentId) {
      const [document] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, input.sourceDocumentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId), eq(documents.classification, "supplier"))).limit(1);
      if (!document) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المستند المصدر غير متاح ضمن وثائق المورد للشركة." });
    }
    const totals = calculateInvoiceTotals(input.lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: "0", taxRateBps: line.taxRateBps })));
    return db.transaction(async (tx) => {
      const result = await tx.insert(supplierInvoices).values({ tenantId: input.tenantId, companyId: input.companyId, supplierId: input.supplierId, sourceDocumentId: input.sourceDocumentId, supplierInvoiceNumber: input.supplierInvoiceNumber, invoiceDate: new Date(input.invoiceDate), dueDate: input.dueDate ? new Date(input.dueDate) : undefined, subtotal: totals.subtotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal, status: "draft", createdByUserId: ctx.user.id });
      const supplierInvoiceId = Number(result[0].insertId);
      await tx.insert(supplierInvoiceLines).values(input.lines.map((line, index) => { const lineTotals = calculateInvoiceTotals([{ quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: "0", taxRateBps: line.taxRateBps }]); return { tenantId: input.tenantId, supplierInvoiceId, expenseAccountId: line.expenseAccountId, costCenterId: line.costCenterId, projectId: line.projectId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, taxRate: String(line.taxRateBps / 100), taxAmount: lineTotals.taxTotal, lineTotal: lineTotals.grandTotal, sortOrder: index }; }));
      if (input.sourceDocumentId) await tx.insert(documentLinks).values({ tenantId: input.tenantId, documentId: input.sourceDocumentId, entityType: "supplier_invoice", entityId: supplierInvoiceId });
      await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "supplier_invoice.drafted", entityType: "supplier_invoice", entityId: supplierInvoiceId, newValue: { supplierInvoiceNumber: input.supplierInvoiceNumber, totals, sourceDocumentId: input.sourceDocumentId } });
      return { id: supplierInvoiceId, totals };
    });
  }),

  submitSupplierInvoiceForReview: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), supplierInvoiceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [invoice] = await db.select({ id: supplierInvoices.id, status: supplierInvoices.status }).from(supplierInvoices).where(and(eq(supplierInvoices.id, input.supplierInvoiceId), eq(supplierInvoices.tenantId, input.tenantId), eq(supplierInvoices.companyId, input.companyId))).limit(1);
    if (!invoice || !canTransitionSupplierInvoice(invoice.status, "pending_review")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إرسال فاتورة المورد للمراجعة من حالتها الحالية." });
    await db.update(supplierInvoices).set({ status: "pending_review" }).where(eq(supplierInvoices.id, invoice.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "supplier_invoice.submitted", entityType: "supplier_invoice", entityId: invoice.id });
    return { submitted: true };
  }),

  approveSupplierInvoice: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), supplierInvoiceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [invoice] = await db.select({ id: supplierInvoices.id, status: supplierInvoices.status }).from(supplierInvoices).where(and(eq(supplierInvoices.id, input.supplierInvoiceId), eq(supplierInvoices.tenantId, input.tenantId), eq(supplierInvoices.companyId, input.companyId))).limit(1);
    if (!invoice || !canTransitionSupplierInvoice(invoice.status, "approved")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم إرسال فاتورة المورد للمراجعة قبل اعتمادها." });
    await db.update(supplierInvoices).set({ status: "approved", approvedByUserId: ctx.user.id, approvedAt: new Date() }).where(eq(supplierInvoices.id, invoice.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "supplier_invoice.approved", entityType: "supplier_invoice", entityId: invoice.id });
    return { approved: true };
  }),
});
