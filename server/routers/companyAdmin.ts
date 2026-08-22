import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { adminDataExportRequests, adminSupportAccessGrants, appRoles, auditLogs, branches, companies, companyMemberInvitations, internalNotifications, securityEvents, subscriptionPlans, tenantFeatureEntitlements, tenantSubscriptions, tenantUsageCounters, tenantUsers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const scopeInput = z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() });
const adminRoleCodes = new Set(["company_admin", "super_admin"]);

async function requireCompanyAdmin(userId: number, input: z.infer<typeof scopeInput>) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [member] = await db.select({ membership: tenantUsers, role: appRoles, company: companies }).from(tenantUsers).innerJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).innerJoin(companies, eq(companies.id, tenantUsers.companyId)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member || !adminRoleCodes.has(member.role.code)) throw new TRPCError({ code: "FORBIDDEN", message: "هذه العملية متاحة لمدير النظام داخل الشركة الحالية فقط." });
  return { db, member };
}

export const companyAdminRouter = router({
  dashboard: protectedProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    const { db } = await requireCompanyAdmin(ctx.user.id, input);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [members, activeMembers, disabledMembers, roles, branchesCount, invitations, securityAlerts, recentLogins, auditWarnings] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId))),
      db.select({ count: sql<number>`COUNT(*)` }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))),
      db.select({ count: sql<number>`COUNT(*)` }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "disabled"))),
      db.select({ count: sql<number>`COUNT(DISTINCT roleId)` }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId))),
      db.select({ count: sql<number>`COUNT(*)` }).from(branches).where(and(eq(branches.tenantId, input.tenantId), eq(branches.companyId, input.companyId), eq(branches.isActive, true))),
      db.select({ count: sql<number>`COUNT(*)` }).from(companyMemberInvitations).where(and(eq(companyMemberInvitations.tenantId, input.tenantId), eq(companyMemberInvitations.companyId, input.companyId), eq(companyMemberInvitations.status, "pending"))),
      db.select({ count: sql<number>`COUNT(*)` }).from(securityEvents).where(and(eq(securityEvents.companyId, input.companyId), eq(securityEvents.eventType, "login_failed"), gte(securityEvents.createdAt, thirtyDaysAgo))),
      db.select({ id: users.id, name: users.name, email: users.email, lastSignedIn: users.lastSignedIn }).from(users).innerJoin(tenantUsers, eq(tenantUsers.userId, users.id)).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId))).orderBy(desc(users.lastSignedIn)).limit(8),
      db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs).where(and(eq(auditLogs.tenantId, input.tenantId), eq(auditLogs.companyId, input.companyId), gte(auditLogs.createdAt, thirtyDaysAgo), sql`${auditLogs.action} LIKE 'team.%'`)),
    ]);
    // Optional subscription/usage tables may not exist in an older production database. Do not block the core admin workspace on those optional metrics.
    const subscription = [] as Array<{ subscription: typeof tenantSubscriptions.$inferSelect; plan: typeof subscriptionPlans.$inferSelect }>;
    const usage: typeof tenantUsageCounters.$inferSelect[] = [];
    const integrationsCount = 0;
    return { counts: { members: Number(members[0]?.count ?? 0), activeMembers: Number(activeMembers[0]?.count ?? 0), disabledMembers: Number(disabledMembers[0]?.count ?? 0), roles: Number(roles[0]?.count ?? 0), branches: Number(branchesCount[0]?.count ?? 0), pendingInvitations: Number(invitations[0]?.count ?? 0), failedLogins30d: Number(securityAlerts[0]?.count ?? 0), auditWarnings: Number(auditWarnings[0]?.count ?? 0) }, subscription: subscription[0] ?? null, usage, recentLogins, integrationsCount, attention: { pendingInvitations: Number(invitations[0]?.count ?? 0) > 0, failedLogins: Number(securityAlerts[0]?.count ?? 0) > 0, auditWarnings: Number(auditWarnings[0]?.count ?? 0) > 0 } };
  }),
  auditLog: protectedProcedure.input(scopeInput.extend({ limit: z.number().int().min(1).max(100).default(50) })).query(async ({ ctx, input }) => { const { db } = await requireCompanyAdmin(ctx.user.id, input); return db.select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, actorUserId: auditLogs.actorUserId, previousValue: auditLogs.previousValue, newValue: auditLogs.newValue, ipAddress: auditLogs.ipAddress, createdAt: auditLogs.createdAt }).from(auditLogs).where(and(eq(auditLogs.tenantId, input.tenantId), eq(auditLogs.companyId, input.companyId), sql`${auditLogs.action} NOT LIKE 'journal.%'`)).orderBy(desc(auditLogs.createdAt)).limit(input.limit); }),
  requestDataExport: protectedProcedure.input(scopeInput.extend({ scopeCode: z.string().trim().min(2).max(120), reason: z.string().trim().min(5).max(1000), confirmed: z.boolean() })).mutation(async ({ ctx, input }) => { const { db } = await requireCompanyAdmin(ctx.user.id, input); if (!input.confirmed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم تأكيد طلب تصدير بيانات الشركة قبل تسجيله." }); const result = await db.insert(adminDataExportRequests).values({ tenantId: input.tenantId, companyId: input.companyId, requestedByUserId: ctx.user.id, scopeCode: input.scopeCode, reason: input.reason, status: "confirmed", confirmedAt: new Date() }); await db.insert(internalNotifications).values({ tenantId: input.tenantId, companyId: input.companyId, recipientUserId: null, eventType: "admin.data_export_requested", titleAr: "طلب تصدير بيانات الشركة", bodyAr: `تم تسجيل طلب تصدير إداري بنطاق ${input.scopeCode}.`, entityType: "admin_data_export", entityId: Number(result[0].insertId), status: "unread" }); return { id: Number(result[0].insertId), status: "confirmed" as const }; }),
  grantSupportAccess: protectedProcedure.input(scopeInput.extend({ scopeCode: z.string().trim().min(2).max(120), reason: z.string().trim().min(5).max(1000), startsAt: z.coerce.date(), endsAt: z.coerce.date(), confirmed: z.boolean() })).mutation(async ({ ctx, input }) => { const { db } = await requireCompanyAdmin(ctx.user.id, input); if (!input.confirmed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم تأكيد منح الوصول المؤقت." }); if (input.endsAt <= input.startsAt || input.endsAt.getTime() - input.startsAt.getTime() > 24 * 60 * 60 * 1000) throw new TRPCError({ code: "BAD_REQUEST", message: "مدة الدعم يجب أن تكون موجبة ولا تتجاوز 24 ساعة." }); const result = await db.insert(adminSupportAccessGrants).values({ tenantId: input.tenantId, companyId: input.companyId, grantedByUserId: ctx.user.id, scopeCode: input.scopeCode, reason: input.reason, startsAt: input.startsAt, endsAt: input.endsAt, status: "requested" }); return { id: Number(result[0].insertId), status: "requested" as const }; }),
  listSupportAccess: protectedProcedure.input(scopeInput).query(async ({ ctx, input }) => { const { db } = await requireCompanyAdmin(ctx.user.id, input); return db.select().from(adminSupportAccessGrants).where(and(eq(adminSupportAccessGrants.tenantId, input.tenantId), eq(adminSupportAccessGrants.companyId, input.companyId))).orderBy(desc(adminSupportAccessGrants.createdAt)).limit(30); }),
});

