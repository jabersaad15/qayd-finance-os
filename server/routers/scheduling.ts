import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { companies, financialReminderSchedules, tenantUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { COOKIE_NAME } from "../../shared/const";
import { protectedProcedure, router } from "../_core/trpc";
import { PRODUCT_BRAND } from "../../shared/productBrand";

const cron = z.string().regex(/^\d+\s+\d+\s+\d+\s+(\*|\d+)\s+(\*|\d+)\s+(\*|\d+)$/, "صيغة cron يجب أن تتضمن ستة حقول بتوقيت UTC.");
const reminderTypes = ["vat_due", "financial_digest", "approval_pending", "customer_payment_due"] as const;

async function accessCompany(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [membership] = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك حق الوصول إلى هذه الشركة." });
  return db;
}

export const schedulingRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    return db.select().from(financialReminderSchedules).where(and(eq(financialReminderSchedules.tenantId, input.tenantId), eq(financialReminderSchedules.companyId, input.companyId)));
  }),

  configure: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), reminderType: z.enum(reminderTypes), cronExpression: cron, enabled: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [company] = await db.select({ legalNameAr: companies.legalNameAr }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "الشركة غير موجودة." });
    const [existing] = await db.select().from(financialReminderSchedules).where(and(eq(financialReminderSchedules.tenantId, input.tenantId), eq(financialReminderSchedules.companyId, input.companyId), eq(financialReminderSchedules.reminderType, input.reminderType))).limit(1);
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    if (!existing) {
      const job = await createHeartbeatJob({ name: `qayd-${input.reminderType}-${input.tenantId}-${input.companyId}`, cron: input.cronExpression, path: "/api/scheduled/finance-reminders", payload: {}, description: `${PRODUCT_BRAND.bilingual} ${input.reminderType} — ${company.legalNameAr ?? input.companyId}` }, sessionToken);
      const result = await db.insert(financialReminderSchedules).values({ tenantId: input.tenantId, companyId: input.companyId, createdByUserId: ctx.user.id, reminderType: input.reminderType, cronExpression: input.cronExpression, scheduleCronTaskUid: job.taskUid, isEnabled: input.enabled });
      if (!input.enabled) await updateHeartbeatJob(job.taskUid, { enable: false }, sessionToken);
      return { id: Number(result[0].insertId), taskUid: job.taskUid, nextExecutionAt: job.nextExecutionAt ?? null };
    }
    if (!existing.scheduleCronTaskUid) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "إعداد التذكير لا يحمل معرف مهمة صالحاً." });
    const result = await updateHeartbeatJob(existing.scheduleCronTaskUid, { cron: input.cronExpression, enable: input.enabled, path: "/api/scheduled/finance-reminders", description: `${PRODUCT_BRAND.bilingual} ${input.reminderType} — ${company.legalNameAr ?? input.companyId}` }, sessionToken);
    await db.update(financialReminderSchedules).set({ cronExpression: input.cronExpression, isEnabled: input.enabled }).where(eq(financialReminderSchedules.id, existing.id));
    return { id: existing.id, taskUid: existing.scheduleCronTaskUid, nextExecutionAt: result.nextExecutionAt ?? null };
  }),
});
