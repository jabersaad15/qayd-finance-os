import { and, eq, gte, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appRoles, invoices, kpiDefinitions, salesActivities, salesOpportunities, salesVisits, tenantUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const metricCodes = ["activities_completed", "opportunities_won", "completed_visits", "weighted_pipeline", "invoices_issued", "overdue_collection"] as const;
const managerRoles = new Set(["company_admin", "super_admin", "cfo", "finance_manager"]);

type KpiMetric = (typeof metricCodes)[number];

export function isKpiVisible(definition: { assignedUserId: number | null; roleCode: string | null }, userId: number, roleCode: string) {
  return definition.assignedUserId === userId || (!definition.assignedUserId && (!definition.roleCode || definition.roleCode === roleCode));
}

function periodStart(period: "daily" | "weekly" | "monthly" | "quarterly") {
  const now = new Date();
  const start = new Date(now);
  if (period === "daily") start.setUTCHours(0, 0, 0, 0);
  if (period === "weekly") start.setUTCDate(start.getUTCDate() - 6);
  if (period === "monthly") start.setUTCDate(1);
  if (period === "quarterly") start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end: new Date(now.getTime() + 86400000) };
}

async function requireMembership(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [membership] = await db.select({ membership: tenantUsers, role: appRoles }).from(tenantUsers).leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية فعالة في الشركة المطلوبة." });
  return { db, roleCode: membership.role?.code ?? "read_only" };
}

async function calculateMetric(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, input: { tenantId: number; companyId: number; userId: number; metricCode: KpiMetric; period: "daily" | "weekly" | "monthly" | "quarterly" }) {
  const { start, end } = periodStart(input.period);
  if (input.metricCode === "activities_completed") {
    const rows = await db.select({ id: salesActivities.id }).from(salesActivities).where(and(eq(salesActivities.tenantId, input.tenantId), eq(salesActivities.companyId, input.companyId), eq(salesActivities.ownerUserId, input.userId), eq(salesActivities.status, "completed"), gte(salesActivities.completedAt, start), lt(salesActivities.completedAt, end)));
    return rows.length;
  }
  if (input.metricCode === "opportunities_won") {
    const rows = await db.select({ id: salesOpportunities.id }).from(salesOpportunities).where(and(eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId), eq(salesOpportunities.ownerUserId, input.userId), eq(salesOpportunities.stage, "won"), gte(salesOpportunities.updatedAt, start), lt(salesOpportunities.updatedAt, end)));
    return rows.length;
  }
  if (input.metricCode === "completed_visits") {
    const rows = await db.select({ id: salesVisits.id }).from(salesVisits).where(and(eq(salesVisits.tenantId, input.tenantId), eq(salesVisits.companyId, input.companyId), eq(salesVisits.salesRepUserId, input.userId), eq(salesVisits.status, "completed"), gte(salesVisits.visitedAt, start), lt(salesVisits.visitedAt, end)));
    return rows.length;
  }
  if (input.metricCode === "weighted_pipeline") {
    const rows = await db.select({ expectedValue: salesOpportunities.expectedValue, probability: salesOpportunities.probability }).from(salesOpportunities).where(and(eq(salesOpportunities.tenantId, input.tenantId), eq(salesOpportunities.companyId, input.companyId), eq(salesOpportunities.ownerUserId, input.userId), gte(salesOpportunities.updatedAt, start), lt(salesOpportunities.updatedAt, end)));
    return rows.reduce((sum, row) => sum + Number(row.expectedValue) * Number(row.probability) / 100, 0);
  }
  if (input.metricCode === "invoices_issued") {
    const rows = await db.select({ grandTotal: invoices.grandTotal }).from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), gte(invoices.issueDate, start), lt(invoices.issueDate, end)));
    return rows.reduce((sum, row) => sum + Number(row.grandTotal), 0);
  }
  const rows = await db.select({ grandTotal: invoices.grandTotal, paidTotal: invoices.paidTotal, dueDate: invoices.dueDate }).from(invoices).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), lt(invoices.dueDate, end)));
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row.grandTotal) - Number(row.paidTotal)), 0);
}

export const kpiRouter = router({
  myDashboard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireMembership(ctx.user.id, input.tenantId, input.companyId);
    const definitions = await db.select().from(kpiDefinitions).where(and(eq(kpiDefinitions.tenantId, input.tenantId), eq(kpiDefinitions.companyId, input.companyId), eq(kpiDefinitions.isActive, true)));
    const visible = definitions.filter((item) => isKpiVisible(item, ctx.user.id, roleCode));
    const values = await Promise.all(visible.map(async (definition) => ({ ...definition, actualValue: await calculateMetric(db, { tenantId: input.tenantId, companyId: input.companyId, userId: ctx.user.id, metricCode: definition.metricCode, period: definition.period }), roleCode })));
    return { roleCode, kpis: values };
  }),
  create: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), nameAr: z.string().min(2).max(160), metricCode: z.enum(metricCodes), targetValue: z.number().positive(), period: z.enum(["daily", "weekly", "monthly", "quarterly"]), roleCode: z.string().max(64).optional(), assignedUserId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireMembership(ctx.user.id, input.tenantId, input.companyId);
    if (!managerRoles.has(roleCode)) throw new TRPCError({ code: "FORBIDDEN", message: "تخصيص مؤشرات الأداء متاح للإدارة المالية والإدارية فقط." });
    if (!input.roleCode && !input.assignedUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر دوراً أو موظفاً لإسناد المؤشر." });
    const [created] = await db.insert(kpiDefinitions).values({ ...input, targetValue: input.targetValue.toFixed(6), createdByUserId: ctx.user.id });
    return { id: Number(created.insertId) };
  }),
  remove: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), kpiId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireMembership(ctx.user.id, input.tenantId, input.companyId);
    if (!managerRoles.has(roleCode)) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية تعديل مؤشرات الأداء." });
    await db.update(kpiDefinitions).set({ isActive: false }).where(and(eq(kpiDefinitions.id, input.kpiId), eq(kpiDefinitions.tenantId, input.tenantId), eq(kpiDefinitions.companyId, input.companyId)));
    return { removed: true };
  }),
});
