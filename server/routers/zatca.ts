import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appRoles, companies, tenantUsers, zatcaCredentials, zatcaEgsUnits } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { appendAuditLog } from "../finance/auditLog";
import { decryptZatcaSecret, encryptZatcaSecret, redactZatcaError } from "../finance/zatcaCrypto";
import { requestSimulationComplianceCsid, validateCsrPem } from "../finance/zatcaService";
import { generateSimulationCsr, selectCsrLegalName } from "../finance/zatcaCsrService";
import { requestSimulationProductionCsid, runSimulationComplianceCheck } from "../finance/zatcaGateway";

const environmentSchema = z.enum(["simulation", "production"]);
const serialSchema = z.string().trim().regex(/^(?=.*[A-Z])[A-Z0-9][A-Z0-9._-]{2,127}$/, "رقم EGS يجب أن يحتوي حرفًا إنجليزيًا واحدًا على الأقل، ولا يقبل رمز OTP المكوّن من أرقام فقط.");

async function companyAccess(userId: number, tenantId: number, companyId: number, write = false) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const members = await db.select({ memberId: tenantUsers.id, roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  const member = members[0];
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك حق الوصول إلى إعدادات هذه الشركة." });
  if (write && !["admin", "super_admin", "company_admin", "cfo", "chief_accountant", "accountant"].includes(member.roleCode ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "تعديل إعدادات ZATCA متاح للإدارة المالية المخولة فقط." });
  return db;
}

function safeEgs(egs: typeof zatcaEgsUnits.$inferSelect) {
  return {
    id: egs.id,
    branchId: egs.branchId,
    environment: egs.environment,
    deviceName: egs.deviceName,
    serialNumber: egs.serialNumber,
    invoiceType: egs.invoiceType,
    status: egs.status,
    csrStatus: egs.csrStatus,
    complianceCsidStatus: egs.complianceCsidStatus,
    complianceCheckStatus: egs.complianceCheckStatus,
    productionCsidStatus: egs.productionCsidStatus,
    connectionStatus: egs.connectionStatus,
    certificateExpiresAt: egs.certificateExpiresAt,
    lastSuccessfulConnection: egs.lastSuccessfulConnection,
    createdAt: egs.createdAt,
    updatedAt: egs.updatedAt,
  };
}

export function buildSimulationCsrInput(company: { legalNameAr: string; legalNameEn?: string | null; vatNumber: string; email?: string | null; nationalAddress?: string | null; city?: string | null; countryCode?: string | null }, serialNumber: string) {
  return { legalName: selectCsrLegalName(company.legalNameEn, company.legalNameAr), vatNumber: company.vatNumber, serialNumber, email: company.email, nationalAddress: company.nationalAddress, city: company.city, countryCode: company.countryCode };
}

export const zatcaRouter = router({
  settings: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await companyAccess(ctx.user.id, input.tenantId, input.companyId);
    const [company] = await db.select({ vatNumber: companies.vatNumber, legalNameAr: companies.legalNameAr }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    const egs = await db.select().from(zatcaEgsUnits).where(and(eq(zatcaEgsUnits.tenantId, input.tenantId), eq(zatcaEgsUnits.companyId, input.companyId))).orderBy(desc(zatcaEgsUnits.createdAt));
    const credentials = await db.select({ id: zatcaCredentials.id, egsId: zatcaCredentials.egsId, environment: zatcaCredentials.environment, credentialType: zatcaCredentials.credentialType, requestId: zatcaCredentials.requestId, issuedAt: zatcaCredentials.issuedAt, expiresAt: zatcaCredentials.expiresAt, status: zatcaCredentials.status }).from(zatcaCredentials).where(and(eq(zatcaCredentials.tenantId, input.tenantId), eq(zatcaCredentials.companyId, input.companyId))).orderBy(desc(zatcaCredentials.updatedAt));
    return { company: company ?? null, egs: egs.map(safeEgs), credentials };
  }),

  createEgs: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), branchId: z.number().int().positive().nullable().optional(), environment: environmentSchema.default("simulation"), deviceName: z.string().trim().min(2).max(255), serialNumber: serialSchema, invoiceType: z.enum(["standard", "simplified", "both"]).default("both") })).mutation(async ({ ctx, input }) => {
    const db = await companyAccess(ctx.user.id, input.tenantId, input.companyId, true);
    const [existing] = await db.select({ id: zatcaEgsUnits.id }).from(zatcaEgsUnits).where(and(eq(zatcaEgsUnits.tenantId, input.tenantId), eq(zatcaEgsUnits.companyId, input.companyId), eq(zatcaEgsUnits.environment, input.environment), eq(zatcaEgsUnits.serialNumber, input.serialNumber))).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "رقم EGS مستخدم مسبقاً في هذه البيئة." });
    const [created] = await db.insert(zatcaEgsUnits).values({ tenantId: input.tenantId, companyId: input.companyId, branchId: input.branchId ?? null, environment: input.environment, deviceName: input.deviceName, serialNumber: input.serialNumber, invoiceType: input.invoiceType, status: "draft", createdByUserId: ctx.user.id }).$returningId();
    const [egs] = await db.select().from(zatcaEgsUnits).where(eq(zatcaEgsUnits.id, created.id)).limit(1);
    if (!egs) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء وحدة EGS." });
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "zatca.egs_created", entityType: "zatca_egs", entityId: egs.id, newValue: { environment: egs.environment, deviceName: egs.deviceName, serialNumber: egs.serialNumber, invoiceType: egs.invoiceType } });
    return safeEgs(egs);
  }),

  generateCsr: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), egsId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await companyAccess(ctx.user.id, input.tenantId, input.companyId, true);
    const [egs] = await db.select().from(zatcaEgsUnits).where(and(eq(zatcaEgsUnits.id, input.egsId), eq(zatcaEgsUnits.tenantId, input.tenantId), eq(zatcaEgsUnits.companyId, input.companyId), eq(zatcaEgsUnits.environment, "simulation"))).limit(1);
    const [company] = await db.select({ legalNameAr: companies.legalNameAr, legalNameEn: companies.legalNameEn, vatNumber: companies.vatNumber, email: companies.email, nationalAddress: companies.nationalAddress, city: companies.city, countryCode: companies.countryCode }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!egs || !company) throw new TRPCError({ code: "NOT_FOUND", message: "وحدة EGS أو الشركة غير موجودة ضمن البيئة الحالية." });
    const vatNumber = company.vatNumber;
    if (!vatNumber) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أكمل الرقم الضريبي للشركة قبل توليد CSR." });
    try {
      const generated = await generateSimulationCsr(buildSimulationCsrInput({ ...company, vatNumber }, egs.serialNumber));
      await db.update(zatcaEgsUnits).set({ status: "onboarding", csrStatus: "issued", csrPemEncrypted: encryptZatcaSecret(generated.csrPem), privateKeyEncrypted: encryptZatcaSecret(generated.privateKeyPem), connectionStatus: "degraded" }).where(eq(zatcaEgsUnits.id, egs.id));
      await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "zatca.csr_generated", entityType: "zatca_egs", entityId: egs.id, newValue: { environment: "simulation", csrStatus: "issued", serialNumber: egs.serialNumber } });
      return { egsId: egs.id, status: "issued" as const, csrPem: generated.csrPem };
    } catch (error) {
      await db.update(zatcaEgsUnits).set({ csrStatus: "failed", connectionStatus: "failed" }).where(eq(zatcaEgsUnits.id, egs.id));
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر توليد CSR للمحاكاة." });
    }
  }),

  startComplianceOnboarding: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), egsId: z.number().int().positive(), otp: z.string().trim().min(4).max(64), csrPem: z.string().min(100).max(20000) })).mutation(async ({ ctx, input }) => {
    const db = await companyAccess(ctx.user.id, input.tenantId, input.companyId, true);
    const [egs] = await db.select().from(zatcaEgsUnits).where(and(eq(zatcaEgsUnits.id, input.egsId), eq(zatcaEgsUnits.tenantId, input.tenantId), eq(zatcaEgsUnits.companyId, input.companyId), eq(zatcaEgsUnits.environment, "simulation"))).limit(1);
    if (!egs) throw new TRPCError({ code: "NOT_FOUND", message: "وحدة EGS للمحاكاة غير موجودة أو لا تنتمي إلى الشركة." });
    const [company] = await db.select({ vatNumber: companies.vatNumber }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company?.vatNumber) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أكمل الرقم الضريبي للشركة قبل بدء ZATCA onboarding." });
    const csrPem = validateCsrPem(input.csrPem);
    await db.update(zatcaEgsUnits).set({ status: "onboarding", csrStatus: "issued", complianceCsidStatus: "pending", connectionStatus: "degraded", csrPemEncrypted: encryptZatcaSecret(csrPem) }).where(eq(zatcaEgsUnits.id, egs.id));
    let completionStage = "request_zatca";
    try {
      const result = await requestSimulationComplianceCsid({ otp: input.otp, csrPem, companyVatNumber: company.vatNumber });
      completionStage = "validate_response_fields";
      if (!result.requestId || !result.binarySecurityToken || !result.secret) throw new Error("ZATCA response did not include the required Compliance CSID fields.");
      completionStage = "persist_encrypted_credential";
      await db.transaction(async (tx) => {
        await tx.insert(zatcaCredentials).values({ tenantId: input.tenantId, companyId: input.companyId, egsId: egs.id, environment: "simulation", credentialType: "compliance_csid", requestId: result.requestId, encryptedBinarySecurityToken: encryptZatcaSecret(result.binarySecurityToken!), encryptedSecret: encryptZatcaSecret(result.secret!), issuedAt: new Date(), status: "active" });
        await tx.update(zatcaEgsUnits).set({ status: "active", complianceCsidStatus: "issued", connectionStatus: "connected", lastSuccessfulConnection: new Date() }).where(eq(zatcaEgsUnits.id, egs.id));
        await appendAuditLog(tx, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "zatca.compliance_csid_issued", entityType: "zatca_egs", entityId: egs.id, newValue: { environment: "simulation", credentialType: "compliance_csid", requestId: result.requestId, status: result.status ?? "issued" } });
      });
      completionStage = "completed";
      return { ok: true, egsId: egs.id, requestId: result.requestId, status: "issued" as const, message: "Compliance CSID issued successfully in Simulation." };
    } catch (error) {
      await db.update(zatcaEgsUnits).set({ status: "onboarding", complianceCsidStatus: "failed", connectionStatus: "failed" }).where(eq(zatcaEgsUnits.id, egs.id));
      console.error("[ZATCA] Compliance CSID local completion failed", { stage: completionStage, reason: redactZatcaError(error) });
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر بدء ZATCA onboarding." });
    }
  }),

  runComplianceCheck: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), egsId: z.number().int().positive(), invoiceHash: z.string().regex(/^[a-f0-9]{64}$/i), uuid: z.string().regex(/^[0-9a-f-]{16,64}$/i), invoiceXmlBase64: z.string().min(100).max(2_000_000) })).mutation(async ({ ctx, input }) => {
    const db = await companyAccess(ctx.user.id, input.tenantId, input.companyId, true);
    const [credential] = await db.select({ token: zatcaCredentials.encryptedBinarySecurityToken, secret: zatcaCredentials.encryptedSecret }).from(zatcaCredentials).where(and(eq(zatcaCredentials.tenantId, input.tenantId), eq(zatcaCredentials.companyId, input.companyId), eq(zatcaCredentials.egsId, input.egsId), eq(zatcaCredentials.environment, "simulation"), eq(zatcaCredentials.credentialType, "compliance_csid"), eq(zatcaCredentials.status, "active"))).orderBy(desc(zatcaCredentials.updatedAt)).limit(1);
    if (!credential?.token || !credential.secret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أصدر Compliance CSID للمحاكاة قبل تشغيل Compliance Check." });
    try {
      const result = await runSimulationComplianceCheck({ invoiceHash: input.invoiceHash, uuid: input.uuid, invoiceXmlBase64: input.invoiceXmlBase64, credential: { token: decryptZatcaSecret(credential.token), secret: decryptZatcaSecret(credential.secret) } });
      await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "zatca.compliance_check_submitted", entityType: "zatca_egs", entityId: input.egsId, newValue: { environment: "simulation", uuid: input.uuid, status: result.status, requestId: result.requestId, warningsCount: result.warnings.length, errorsCount: result.errors.length } });
      await db.update(zatcaEgsUnits).set({ complianceCheckStatus: result.errors.length ? "failed" : "issued", connectionStatus: result.errors.length ? "degraded" : "connected", lastSuccessfulConnection: result.errors.length ? undefined : new Date() }).where(eq(zatcaEgsUnits.id, input.egsId));
      return { status: result.status, requestId: result.requestId, warnings: result.warnings, errors: result.errors, responseReference: result.responseReference };
    } catch (error) {
      await db.update(zatcaEgsUnits).set({ complianceCheckStatus: "failed", connectionStatus: "failed" }).where(eq(zatcaEgsUnits.id, input.egsId));
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر تشغيل Compliance Check." });
    }
  }),

  requestSimulationProductionCsid: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), egsId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await companyAccess(ctx.user.id, input.tenantId, input.companyId, true);
    const [credential] = await db.select({ requestId: zatcaCredentials.requestId, token: zatcaCredentials.encryptedBinarySecurityToken, secret: zatcaCredentials.encryptedSecret }).from(zatcaCredentials).where(and(eq(zatcaCredentials.tenantId, input.tenantId), eq(zatcaCredentials.companyId, input.companyId), eq(zatcaCredentials.egsId, input.egsId), eq(zatcaCredentials.environment, "simulation"), eq(zatcaCredentials.credentialType, "compliance_csid"), eq(zatcaCredentials.status, "active"))).orderBy(desc(zatcaCredentials.updatedAt)).limit(1);
    if (!credential?.requestId || !credential.token || !credential.secret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب إصدار Compliance CSID قبل طلب Simulation Production CSID." });
    try {
      const result = await requestSimulationProductionCsid({ requestId: credential.requestId, credential: { token: decryptZatcaSecret(credential.token), secret: decryptZatcaSecret(credential.secret) } });
      if (result.errors.length) throw new Error(result.errors.join(" "));
      await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "zatca.simulation_production_csid_requested", entityType: "zatca_egs", entityId: input.egsId, newValue: { environment: "simulation", status: result.status, requestId: result.requestId } });
      return { status: result.status, requestId: result.requestId, warnings: result.warnings, errors: result.errors };
    } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر طلب Simulation Production CSID." }); }
  }),
});
