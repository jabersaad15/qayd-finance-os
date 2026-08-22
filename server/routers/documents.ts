import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { documentRetentionPolicies, documents, tenantUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { appendAuditLog } from "../finance/auditLog";
import { storageGet, storageGetSignedUrl, storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { canArchiveDocument, canDeleteDocument, retentionUntil } from "../finance/documentRetention";

const classifications = ["zatca", "vat", "zakat", "bank", "audit", "supplier", "customer", "contract", "financial_statement", "miscellaneous"] as const;
const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);

export function buildDocumentStorageKey(input: { tenantId: number; companyId: number; classification: string; filename: string; nonce?: string }) {
  const extension = input.filename.match(/\.[A-Za-z0-9]{1,10}$/)?.[0].toLowerCase() ?? "";
  const nonce = input.nonce ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `tenants/${input.tenantId}/companies/${input.companyId}/${input.classification}/document-${nonce}${extension}`;
}

async function accessCompany(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const member = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member[0]) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك حق الوصول إلى هذه الشركة." });
  return db;
}

export const documentsRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), classification: z.enum(classifications).optional() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const filters = [eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId)];
    if (input.classification) filters.push(eq(documents.classification, input.classification));
    const rows = await db.select().from(documents).where(and(...filters)).orderBy(desc(documents.createdAt));
    return Promise.all(rows.map(async (document) => ({ ...document, url: (await storageGet(document.fileKey)).url })));
  }),

  upload: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), classification: z.enum(classifications), filename: z.string().min(1).max(255), mimeType: z.string().min(3).max(128), dataBase64: z.string().min(4) })).mutation(async ({ ctx, input }) => {
    if (!acceptedTypes.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "نوع الملف غير مسموح في النسخة الحالية." });
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const buffer = Buffer.from(input.dataBase64, "base64");
    if (buffer.byteLength === 0 || buffer.byteLength > 10 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "يجب أن يكون حجم الملف بين 1 بايت و10 ميغابايت." });
    const storageKey = buildDocumentStorageKey(input);
    const stored = await storagePut(storageKey, buffer, input.mimeType);
    const [policy] = await db.select().from(documentRetentionPolicies).where(and(eq(documentRetentionPolicies.tenantId, input.tenantId), eq(documentRetentionPolicies.companyId, input.companyId), eq(documentRetentionPolicies.classification, input.classification), eq(documentRetentionPolicies.isActive, true))).limit(1);
    const createdAt = new Date(); const result = await db.insert(documents).values({ tenantId: input.tenantId, companyId: input.companyId, classification: input.classification, fileKey: stored.key, filename: input.filename, mimeType: input.mimeType, sizeBytes: buffer.byteLength, uploadedByUserId: ctx.user.id, retentionPolicyId: policy?.id, retentionUntil: policy ? retentionUntil(createdAt, policy.retentionYears) : undefined });
    return { id: Number(result[0].insertId), url: stored.url, fileKey: stored.key };
  }),

  retentionDashboard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [policies, documentRows] = await Promise.all([
      db.select().from(documentRetentionPolicies).where(and(eq(documentRetentionPolicies.tenantId, input.tenantId), eq(documentRetentionPolicies.companyId, input.companyId))).orderBy(desc(documentRetentionPolicies.updatedAt)),
      db.select().from(documents).where(and(eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId))).orderBy(desc(documents.createdAt)),
    ]);
    return { policies, documents: documentRows };
  }),

  saveRetentionPolicy: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), classification: z.enum(classifications), retentionYears: z.number().int().min(1).max(50), preventDeletion: z.boolean(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [existing] = await db.select().from(documentRetentionPolicies).where(and(eq(documentRetentionPolicies.tenantId, input.tenantId), eq(documentRetentionPolicies.companyId, input.companyId), eq(documentRetentionPolicies.classification, input.classification))).limit(1);
    if (existing) await db.update(documentRetentionPolicies).set({ retentionYears: input.retentionYears, preventDeletion: input.preventDeletion, isActive: input.isActive }).where(eq(documentRetentionPolicies.id, existing.id));
    else await db.insert(documentRetentionPolicies).values({ ...input, createdByUserId: ctx.user.id });
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "document_retention.policy_saved", entityType: "document_retention_policy", entityId: existing?.id ?? 0, newValue: input });
    return { saved: true };
  }),

  applyRetentionPolicy: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentId: z.number().int().positive(), policyId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [document] = await db.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId))).limit(1);
    const [policy] = await db.select().from(documentRetentionPolicies).where(and(eq(documentRetentionPolicies.id, input.policyId), eq(documentRetentionPolicies.tenantId, input.tenantId), eq(documentRetentionPolicies.companyId, input.companyId), eq(documentRetentionPolicies.isActive, true))).limit(1);
    if (!document || !policy || document.classification !== policy.classification) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم اختيار سياسة نشطة من تصنيف المستند نفسه." });
    await db.update(documents).set({ retentionPolicyId: policy.id, retentionUntil: retentionUntil(new Date(document.createdAt), policy.retentionYears), retentionStatus: document.isLegalHold ? "hold" : "active" }).where(eq(documents.id, document.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "document_retention.applied", entityType: "document", entityId: document.id, newValue: { policyId: policy.id, retentionYears: policy.retentionYears } });
    return { applied: true };
  }),

  archiveDocument: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [document] = await db.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId))).limit(1);
    if (!document || !canArchiveDocument({ isLegalHold: document.isLegalHold, retentionStatus: document.retentionStatus })) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن أرشفة المستند أثناء الحجز أو من حالة الأرشفة الحالية." });
    await db.update(documents).set({ retentionStatus: "archived", archivedAt: new Date() }).where(eq(documents.id, document.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "document_retention.archived", entityType: "document", entityId: document.id });
    return { archived: true };
  }),

  setDocumentLegalHold: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentId: z.number().int().positive(), isLegalHold: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [document] = await db.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId))).limit(1);
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "المستند غير موجود ضمن الشركة." });
    await db.update(documents).set({ isLegalHold: input.isLegalHold, retentionStatus: input.isLegalHold ? "hold" : document.retentionStatus === "hold" ? "active" : document.retentionStatus }).where(eq(documents.id, document.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "document_retention.legal_hold_changed", entityType: "document", entityId: document.id, newValue: { isLegalHold: input.isLegalHold } });
    return { updated: true };
  }),

  deleteDocument: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [document] = await db.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId))).limit(1);
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "المستند غير موجود ضمن الشركة." });
    const [policy] = document.retentionPolicyId ? await db.select().from(documentRetentionPolicies).where(eq(documentRetentionPolicies.id, document.retentionPolicyId)).limit(1) : [];
    if (!canDeleteDocument({ preventDeletion: policy?.preventDeletion ?? true, isLegalHold: document.isLegalHold })) throw new TRPCError({ code: "FORBIDDEN", message: "الحذف محظور بموجب سياسة الاحتفاظ أو الحجز القانوني." });
    throw new TRPCError({ code: "FORBIDDEN", message: "الحذف المادي للمستندات غير مدعوم؛ استخدم الأرشفة للحفاظ على أثر المستند." });
  }),

  extractSupplierInvoice: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [document] = await db.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId))).limit(1);
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "المستند غير موجود ضمن الشركة." });
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(document.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "يدعم الاستخراج فواتير PDF أو الصور فقط." });
    const signedUrl = await storageGetSignedUrl(document.fileKey);
    const response = await invokeLLM({ model: "gemini-3-flash-preview", maxTokens: 1100, messages: [{ role: "system", content: "استخرج بيانات فاتورة مورد من الوثيقة. لا تخترع أي قيمة. عند عدم وضوح الحقل استخدم null. هذه نتيجة اقتراح للمراجعة البشرية وليست قيداً أو اعتماداً محاسبياً." }, { role: "user", content: [{ type: "text", text: "استخرج المورد والتاريخ والرقم الضريبي ورقم الفاتورة والمبالغ والأصناف. أعد JSON مطابقاً للمخطط فقط." }, { type: "file_url", file_url: { url: signedUrl, mime_type: document.mimeType as "application/pdf" } }] }], outputSchema: { name: "supplier_invoice_extraction", strict: true, schema: { type: "object", properties: { supplierName: { type: ["string", "null"] }, invoiceNumber: { type: ["string", "null"] }, invoiceDate: { type: ["string", "null"] }, supplierVatNumber: { type: ["string", "null"] }, subtotal: { type: ["string", "null"] }, vatAmount: { type: ["string", "null"] }, grandTotal: { type: ["string", "null"] }, suggestedExpenseAccountCode: { type: ["string", "null"] }, suggestedCostCenterCode: { type: ["string", "null"] }, confidence: { type: "number" }, items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: ["string", "null"] }, unitPrice: { type: ["string", "null"] }, total: { type: ["string", "null"] } }, required: ["description", "quantity", "unitPrice", "total"], additionalProperties: false } } }, required: ["supplierName", "invoiceNumber", "invoiceDate", "supplierVatNumber", "subtotal", "vatAmount", "grandTotal", "suggestedExpenseAccountCode", "suggestedCostCenterCode", "confidence", "items"], additionalProperties: false } } });
    const raw = response.choices[0]?.message.content;
    const text = typeof raw === "string" ? raw : raw?.filter((part) => part.type === "text").map((part) => part.text).join("") ?? "{}";
    let extraction: Record<string, unknown>;
    try { extraction = JSON.parse(text); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تفسير نتيجة الاستخراج. أعد المحاولة أو راجع المستند يدوياً." }); }
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "document.invoice_extraction_suggested", entityType: "document", entityId: document.id, newValue: { confidence: extraction.confidence, model: "gemini-3-flash-preview" } });
    return { documentId: document.id, extraction, reviewRequired: true };
  }),
});
