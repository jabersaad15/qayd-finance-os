import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { subscriptionPlanEntitlements, subscriptionPlans, tenantFeatureEntitlements, tenantSubscriptions, tenantUsageCounters, tenantUsers, appRoles, tenants } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const managementRoles = new Set(["company_admin", "super_admin", "ceo", "cfo"]);

async function requireMembership(userId: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [member] = await db.select({ id: tenantUsers.id, roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية فعالة في الشركة المطلوبة." });
  return { db, member };
}

export const subscriptionsRouter = router({
  listPlans: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.status, "active")).orderBy(subscriptionPlans.monthlyPrice);
  }),

  current: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db } = await requireMembership(ctx.user.id, input.tenantId);
    const [subscription] = await db.select({ subscription: tenantSubscriptions, plan: subscriptionPlans }).from(tenantSubscriptions).innerJoin(subscriptionPlans, eq(subscriptionPlans.id, tenantSubscriptions.planId)).where(eq(tenantSubscriptions.tenantId, input.tenantId)).orderBy(desc(tenantSubscriptions.createdAt)).limit(1);
    if (!subscription) return { subscription: null, plan: null, entitlements: [], usage: [] } as const;
    const [entitlements, overrides, usage] = await Promise.all([
      db.select().from(subscriptionPlanEntitlements).where(eq(subscriptionPlanEntitlements.planId, subscription.plan.id)),
      db.select().from(tenantFeatureEntitlements).where(eq(tenantFeatureEntitlements.tenantId, input.tenantId)),
      db.select().from(tenantUsageCounters).where(eq(tenantUsageCounters.tenantId, input.tenantId)).orderBy(desc(tenantUsageCounters.updatedAt)).limit(50),
    ]);
    const merged = entitlements.map((item) => {
      const override = overrides.find((candidate) => candidate.featureCode === item.featureCode);
      return { ...item, enabled: override?.enabled ?? item.enabled, limitValue: override?.limitValue ?? item.limitValue, source: override?.source ?? "plan" };
    });
    for (const override of overrides) if (!merged.some((item) => item.featureCode === override.featureCode)) merged.push({ ...override, planId: subscription.plan.id });
    return { subscription: subscription.subscription, plan: subscription.plan, entitlements: merged, usage };
  }),

  changePlan: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), planCode: z.string().min(2).max(64), billingCycle: z.enum(["monthly", "annual"]) })).mutation(async ({ ctx, input }) => {
    const { db, member } = await requireMembership(ctx.user.id, input.tenantId);
    if (!member.roleCode || !managementRoles.has(member.roleCode)) throw new TRPCError({ code: "FORBIDDEN", message: "تغيير الباقة متاح للإدارة المخولة فقط." });
    const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.code, input.planCode), eq(subscriptionPlans.status, "active"))).limit(1);
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "الباقة المطلوبة غير موجودة أو غير مفعلة." });
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
    const periodEndsAt = new Date(now);
    if (input.billingCycle === "annual") periodEndsAt.setFullYear(periodEndsAt.getFullYear() + 1); else periodEndsAt.setMonth(periodEndsAt.getMonth() + 1);
    const [existing] = await db.select({ id: tenantSubscriptions.id }).from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, input.tenantId)).orderBy(desc(tenantSubscriptions.createdAt)).limit(1);
    if (existing) await db.update(tenantSubscriptions).set({ planId: plan.id, billingCycle: input.billingCycle, status: "trialing", trialEndsAt, currentPeriodStartsAt: now, currentPeriodEndsAt: periodEndsAt, cancelledAt: null }).where(eq(tenantSubscriptions.id, existing.id));
    else await db.insert(tenantSubscriptions).values({ tenantId: input.tenantId, planId: plan.id, billingCycle: input.billingCycle, status: "trialing", trialEndsAt, currentPeriodStartsAt: now, currentPeriodEndsAt: periodEndsAt });
    await db.update(tenants).set({ planCode: plan.code, status: "trial" }).where(eq(tenants.id, input.tenantId));
    return { updated: true, planCode: plan.code, status: "trialing" } as const;
  }),
});
