import { and, desc, eq } from "drizzle-orm";
import { createCustomerPortalSecret, hashCustomerPortalSecret, isPortalTokenUsable, portalExpiration } from "../finance/customerPortal";
import { customerPortalEvents, customerPortalTokens, customers, invoices, quotations, tenantUsers, companies } from "../../drizzle/schema";
import { appendAuditLog } from "../finance/auditLog";
import { createInternalNotification } from "../finance/internalNotifications";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export function canCustomerRespondToQuotation(status: string, expiryDate: Date | null, now = new Date()) {
  if (status !== "sent") return false;
  return !expiryDate || new Date(expiryDate).getTime() >= now.getTime();
}

async function requireCompanyMember(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [member] = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.userId, userId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إدارة بوابة العميل لهذه الشركة." });
  return db;
}

async function resolvePortal(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, secret: string) {
  const tokenHash = hashCustomerPortalSecret(secret);
  const [row] = await db.select({ token: customerPortalTokens, customer: customers, company: companies }).from(customerPortalTokens).innerJoin(customers, eq(customerPortalTokens.customerId, customers.id)).innerJoin(companies, eq(customerPortalTokens.companyId, companies.id)).where(eq(customerPortalTokens.tokenHash, tokenHash)).limit(1);
  if (!row || !isPortalTokenUsable(row.token.status, row.token.expiresAt)) throw new TRPCError({ code: "UNAUTHORIZED", message: "رابط البوابة غير صالح أو انتهت صلاحيته." });
  await db.update(customerPortalTokens).set({ lastUsedAt: new Date() }).where(eq(customerPortalTokens.id, row.token.id));
  return row;
}

export const customerPortalRouter = router({
  createAccessLink: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), customerId: z.number().int().positive(), expiresInDays: z.number().int().min(1).max(90).default(30) })).mutation(async ({ ctx, input }) => {
    const db = await requireCompanyMember(ctx.user.id, input.tenantId, input.companyId);
    const [customer] = await db.select({ id: customers.id, name: customers.name }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId), eq(customers.companyId, input.companyId))).limit(1);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود ضمن الشركة." });
    let secret = "";
    let inserted: { insertId: number } | undefined;
    for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
      secret = createCustomerPortalSecret();
      try {
        const [result] = await db.insert(customerPortalTokens).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, tokenHash: hashCustomerPortalSecret(secret), expiresAt: portalExpiration(input.expiresInDays), createdByUserId: ctx.user.id });
        inserted = result as { insertId: number };
      } catch (error) {
        const message = String(error).toLowerCase();
        const duplicateKey = message.includes("duplicate") || message.includes("unique") || message.includes("1062");
        if (!duplicateKey || attempt === 2) throw new TRPCError({ code: duplicateKey ? "CONFLICT" : "INTERNAL_SERVER_ERROR", message: duplicateKey ? "تعذر إنشاء رابط بوابة العميل بسبب تعارض مؤقت. أعد المحاولة." : "تعذر إنشاء رابط بوابة العميل بسبب خطأ في قاعدة البيانات. تم تسجيل الحالة للمراجعة." });
      }
    }
    if (!inserted) throw new TRPCError({ code: "CONFLICT", message: "تعذر إنشاء رابط بوابة العميل. أعد المحاولة." });
    const tokenId = Number(inserted.insertId);
    await db.insert(customerPortalEvents).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: input.customerId, tokenId, eventType: "link_created", entityType: "customer", entityId: input.customerId });
    return { tokenId, customerName: customer.name, accessToken: secret, expiresAt: portalExpiration(input.expiresInDays), path: `/customer-portal/${secret}` };
  }),

  revokeAccessLink: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), tokenId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireCompanyMember(ctx.user.id, input.tenantId, input.companyId);
    await db.update(customerPortalTokens).set({ status: "revoked" }).where(and(eq(customerPortalTokens.id, input.tokenId), eq(customerPortalTokens.tenantId, input.tenantId), eq(customerPortalTokens.companyId, input.companyId)));
    return { revoked: true } as const;
  }),

  session: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(128) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    const row = await resolvePortal(db, input.accessToken);
    await db.insert(customerPortalEvents).values({ tenantId: row.token.tenantId, companyId: row.token.companyId, customerId: row.token.customerId, tokenId: row.token.id, eventType: "portal_access", entityType: "customer", entityId: row.customer.id, ipAddress: ctx.req.ip, userAgent: ctx.req.headers["user-agent"] });
    return { customer: row.customer, company: row.company, expiresAt: row.token.expiresAt };
  }),

  respondToQuotation: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(128), quotationId: z.number().int().positive(), decision: z.enum(["accepted", "rejected"]), note: z.string().trim().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    const row = await resolvePortal(db, input.accessToken);
    const [quotation] = await db.select({ id: quotations.id, quoteNumber: quotations.quoteNumber, status: quotations.status, customerId: quotations.customerId, tenantId: quotations.tenantId, companyId: quotations.companyId, salesOwnerUserId: quotations.salesOwnerUserId, expiryDate: quotations.expiryDate }).from(quotations).where(and(eq(quotations.id, input.quotationId), eq(quotations.tenantId, row.token.tenantId), eq(quotations.companyId, row.token.companyId), eq(quotations.customerId, row.token.customerId))).limit(1);
    if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "عرض السعر غير موجود في بوابة هذا العميل." });
    if (quotation.status !== "sent") throw new TRPCError({ code: "CONFLICT", message: "لا يمكن الرد على عرض السعر لأنه ليس في حالة إرسال." });
    if (!canCustomerRespondToQuotation(quotation.status, quotation.expiryDate)) throw new TRPCError({ code: "CONFLICT", message: "انتهت صلاحية عرض السعر ولا يمكن قبوله أو رفضه." });
    const respondedAt = new Date();
    await db.update(quotations).set({ status: input.decision, customerResponseNote: input.note || null, customerRespondedAt: respondedAt }).where(and(eq(quotations.id, quotation.id), eq(quotations.status, "sent")));
    await db.insert(customerPortalEvents).values({ tenantId: row.token.tenantId, companyId: row.token.companyId, customerId: row.token.customerId, tokenId: row.token.id, eventType: `quotation_${input.decision}`, entityType: "quotation", entityId: quotation.id, ipAddress: ctx.req.ip, userAgent: ctx.req.headers["user-agent"] });
    await appendAuditLog(db, { tenantId: row.token.tenantId, companyId: row.token.companyId, action: `customer_portal.quotation_${input.decision}`, entityType: "quotation", entityId: quotation.id, previousValue: { status: quotation.status }, newValue: { status: input.decision, note: input.note || null, respondedAt: respondedAt.toISOString() }, reason: input.note, ipAddress: ctx.req.ip });
    if (quotation.salesOwnerUserId) await createInternalNotification(db, { tenantId: row.token.tenantId, companyId: row.token.companyId, recipientUserId: quotation.salesOwnerUserId, eventType: `customer_portal.quotation_${input.decision}`, titleAr: input.decision === "accepted" ? "تم قبول عرض سعر" : "تم رفض عرض سعر", bodyAr: `أرسل العميل ${row.customer.name} رداً على عرض السعر ${quotation.quoteNumber}${input.note ? ` مع ملاحظة: ${input.note}` : "."}`, entityType: "quotation", entityId: quotation.id });
    return { quotationId: quotation.id, status: input.decision, respondedAt } as const;
  }),

  documents: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(128) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    const row = await resolvePortal(db, input.accessToken);
    const [customerQuotations, customerInvoices] = await Promise.all([
      db.select({ id: quotations.id, quoteNumber: quotations.quoteNumber, status: quotations.status, issueDate: quotations.issueDate, expiryDate: quotations.expiryDate, grandTotal: quotations.grandTotal, customerResponseNote: quotations.customerResponseNote, customerRespondedAt: quotations.customerRespondedAt }).from(quotations).where(and(eq(quotations.tenantId, row.token.tenantId), eq(quotations.companyId, row.token.companyId), eq(quotations.customerId, row.token.customerId))).orderBy(desc(quotations.issueDate)),
      db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, invoiceType: invoices.invoiceType, status: invoices.status, issueDate: invoices.issueDate, dueDate: invoices.dueDate, grandTotal: invoices.grandTotal, paidTotal: invoices.paidTotal, currencyCode: invoices.currencyCode }).from(invoices).where(and(eq(invoices.tenantId, row.token.tenantId), eq(invoices.companyId, row.token.companyId), eq(invoices.customerId, row.token.customerId))).orderBy(desc(invoices.issueDate)),
    ]);
    return { quotations: customerQuotations, invoices: customerInvoices, customer: row.customer, company: row.company };
  }),
});
