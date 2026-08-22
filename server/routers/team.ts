import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { appRoles, companies, companyMemberInvitations, internalNotifications, tenantUsers, users } from "../../drizzle/schema";
import { appendAuditLog } from "../finance/auditLog";
import { assertMemberChangeAllowed, canManageCompanyMembers, isManagedRoleCode, managedRoleCodes } from "../finance/memberManagement";
import { defaultRoles } from "../finance/rbac";
import { createInternalNotification, teamAccessDisabledNotification, teamInvitationNotification, teamRoleChangedNotification } from "../finance/internalNotifications";
import { buildTeamOwnerAlert } from "../finance/teamOwnerAlerts";
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { hashEmployeePassword, resolveEmployeeUsername } from "../finance/employeeAuth";
import { sendEmployeeInvitationEmail } from "../finance/employeeInvitationEmail";
import { protectedProcedure, router } from "../_core/trpc";

const managedRoleSchema = z.enum(managedRoleCodes);
const tenantCompanyInput = z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() });
const phoneSchema = z.string().trim().regex(/^(?:05\d{8}|\+9665\d{8}|9665\d{8})$/, "أدخل رقم جوال سعودي صحيحاً مثل 05XXXXXXXX أو +9665XXXXXXXX").optional();
function normalizeSaudiPhone(phone?: string) {
  if (!phone) return undefined;
  const value = phone.trim();
  if (value.startsWith("05")) return `+966${value.slice(1)}`;
  if (value.startsWith("966")) return `+${value}`;
  return value;
}

async function ensureManagedRoles(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, tenantId: number) {
  for (const role of defaultRoles.filter((item) => isManagedRoleCode(item.code))) {
    const [existing] = await db.select().from(appRoles).where(and(eq(appRoles.tenantId, tenantId), eq(appRoles.code, role.code))).limit(1);
    if (existing) await db.update(appRoles).set({ nameAr: role.nameAr, isSystem: true }).where(eq(appRoles.id, existing.id));
    else await db.insert(appRoles).values({ tenantId, code: role.code, nameAr: role.nameAr, isSystem: true });
  }
}

async function requireTeamAdmin(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  await ensureManagedRoles(db, tenantId);
  const [member] = await db.select({ id: tenantUsers.id, roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member || !canManageCompanyMembers(member.roleCode)) throw new TRPCError({ code: "FORBIDDEN", message: "إدارة الفريق متاحة للرئيس التنفيذي أو مدير المنصة فقط." });
  return { db, member };
}

async function resolveManagedRole(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, tenantId: number, roleCode: string) {
  const [role] = await db.select().from(appRoles).where(and(eq(appRoles.tenantId, tenantId), eq(appRoles.code, roleCode))).limit(1);
  if (!role || !isManagedRoleCode(role.code)) throw new TRPCError({ code: "BAD_REQUEST", message: "الدور المحدد غير متاح لإدارة الشركة." });
  return role;
}

async function activeOwnerCount(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, tenantId: number, companyId: number) {
  const rows = await db.select({ id: tenantUsers.id }).from(tenantUsers).innerJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"), eq(appRoles.code, "company_admin")));
  return rows.length;
}

function notifyProjectOwner(input: Parameters<typeof buildTeamOwnerAlert>[0]) {
  void notifyOwner(buildTeamOwnerAlert(input)).catch((error) => console.warn("[Team] Owner alert could not be delivered:", error));
}

export const teamRouter = router({
  overview: protectedProcedure.input(tenantCompanyInput).query(async ({ ctx, input }) => {
    const { db } = await requireTeamAdmin(ctx.user.id, input.tenantId, input.companyId);
    const [members, roles, invitations, notifications] = await Promise.all([
      db.select({ membership: tenantUsers, user: { id: users.id, name: users.name, email: users.email, phone: users.phone, lastSignedIn: users.lastSignedIn }, role: { id: appRoles.id, code: appRoles.code, nameAr: appRoles.nameAr } }).from(tenantUsers).innerJoin(users, eq(users.id, tenantUsers.userId)).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId))).orderBy(asc(tenantUsers.createdAt)),
      db.select().from(appRoles).where(eq(appRoles.tenantId, input.tenantId)).orderBy(asc(appRoles.nameAr)),
      db.select({ invitation: companyMemberInvitations, role: { code: appRoles.code, nameAr: appRoles.nameAr } }).from(companyMemberInvitations).leftJoin(appRoles, eq(appRoles.id, companyMemberInvitations.roleId)).where(and(eq(companyMemberInvitations.tenantId, input.tenantId), eq(companyMemberInvitations.companyId, input.companyId))).orderBy(asc(companyMemberInvitations.createdAt)),
      db.select().from(internalNotifications).where(and(eq(internalNotifications.tenantId, input.tenantId), eq(internalNotifications.companyId, input.companyId))).orderBy(desc(internalNotifications.createdAt)),
    ]);
    return { members, roles: roles.filter((role) => isManagedRoleCode(role.code)), invitations, notifications };
  }),

  invite: protectedProcedure.input(tenantCompanyInput.extend({ email: z.string().email().max(320), phone: phoneSchema, displayName: z.string().min(2).max(255).optional(), roleCode: managedRoleSchema, username: z.string().max(320).optional(), temporaryPassword: z.string().min(8).max(128).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTeamAdmin(ctx.user.id, input.tenantId, input.companyId);
    const role = await resolveManagedRole(db, input.tenantId, input.roleCode);
    const email = input.email.trim().toLowerCase();
    const phone = normalizeSaudiPhone(input.phone);
    const username = input.temporaryPassword ? resolveEmployeeUsername(email, input.username) : undefined;
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (input.username && !input.temporaryPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل كلمة المرور المؤقتة مع اسم المستخدم، أو اترك اسم المستخدم فارغاً ليتم توليده تلقائياً من البريد." });
    if (username) {
      const [usernameOwner] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (usernameOwner && usernameOwner.id !== existingUser?.id) throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم مستخدم بالفعل." });
    }
    const [company] = await db.select({ legalNameAr: companies.legalNameAr }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId))).limit(1);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "الشركة غير موجودة." });
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    if (existingUser) {
      if (username || phone) await db.update(users).set({ ...(username ? { username, passwordHash: hashEmployeePassword(input.temporaryPassword!), mustChangePassword: true, loginMethod: "local" } : {}), phone }).where(eq(users.id, existingUser.id));
      const [membership] = await db.select().from(tenantUsers).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.userId, existingUser.id))).limit(1);
      if (membership) {
        await db.update(tenantUsers).set({ companyId: input.companyId, roleId: role.id, status: "active" }).where(eq(tenantUsers.id, membership.id));
        await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "team.member_activated", entityType: "tenant_user", entityId: membership.id, newValue: { userId: existingUser.id, roleCode: role.code, email } });
        await createInternalNotification(db, teamInvitationNotification({ tenantId: input.tenantId, companyId: input.companyId, invitationId: membership.id, email, roleName: role.nameAr, recipientUserId: existingUser.id }));
        notifyProjectOwner({ event: "invited", subject: email, roleName: role.nameAr });
        let emailSent = false;
        if (username) { try { await sendEmployeeInvitationEmail({ to: email, displayName: input.displayName, username, temporaryPassword: input.temporaryPassword!, roleName: role.nameAr, companyName: company.legalNameAr, publicAppUrl: process.env.PUBLIC_APP_URL }); emailSent = true; } catch (error) { console.warn("[Team] Employee invitation email failed:", error); } }
        return { mode: "activated" as const, emailSent };
      }
    }
    let createdUserId: number | undefined = existingUser?.id;
    if (username && !createdUserId) {
      const result = await db.insert(users).values({ openId: `local_${randomUUID()}`, name: input.displayName || email, email, phone, username, passwordHash: hashEmployeePassword(input.temporaryPassword!), mustChangePassword: true, loginMethod: "local" });
      createdUserId = Number(result[0].insertId);
      await db.insert(tenantUsers).values({ tenantId: input.tenantId, companyId: input.companyId, userId: createdUserId, roleId: role.id, status: "active" });
    }
    const [existingInvitation] = await db.select().from(companyMemberInvitations).where(and(eq(companyMemberInvitations.tenantId, input.tenantId), eq(companyMemberInvitations.companyId, input.companyId), eq(companyMemberInvitations.email, email))).limit(1);
    let invitationId: number;
    if (existingInvitation) {
      await db.update(companyMemberInvitations).set({ displayName: input.displayName, roleId: role.id, status: "pending", invitedByUserId: ctx.user.id, acceptedByUserId: null, expiresAt }).where(eq(companyMemberInvitations.id, existingInvitation.id));
      invitationId = existingInvitation.id;
    } else {
      const result = await db.insert(companyMemberInvitations).values({ tenantId: input.tenantId, companyId: input.companyId, email, displayName: input.displayName, roleId: role.id, invitedByUserId: ctx.user.id, expiresAt });
      invitationId = Number(result[0].insertId);
    }
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "team.member_invited", entityType: "company_member_invitation", entityId: invitationId, newValue: { email, roleCode: role.code, expiresAt: expiresAt.toISOString() } });
    await createInternalNotification(db, teamInvitationNotification({ tenantId: input.tenantId, companyId: input.companyId, invitationId, email, roleName: role.nameAr, recipientUserId: existingUser?.id }));
    notifyProjectOwner({ event: "invited", subject: email, roleName: role.nameAr });
    let emailSent = false;
    if (username) { try { await sendEmployeeInvitationEmail({ to: email, displayName: input.displayName, username, temporaryPassword: input.temporaryPassword!, roleName: role.nameAr, companyName: company.legalNameAr, publicAppUrl: process.env.PUBLIC_APP_URL }); emailSent = true; } catch (error) { console.warn("[Team] Employee invitation email failed:", error); } }
    return { mode: username ? "credentials_created" as const : "invited" as const, expiresAt, userId: createdUserId, emailSent };
  }),

  updateMemberPhone: protectedProcedure.input(tenantCompanyInput.extend({ memberId: z.number().int().positive(), phone: phoneSchema })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTeamAdmin(ctx.user.id, input.tenantId, input.companyId);
    const [target] = await db.select({ membership: tenantUsers, user: { id: users.id, phone: users.phone } }).from(tenantUsers).innerJoin(users, eq(users.id, tenantUsers.userId)).where(and(eq(tenantUsers.id, input.memberId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId))).limit(1);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "عضو الفريق غير موجود ضمن الشركة." });
    const phone = normalizeSaudiPhone(input.phone);
    await db.update(users).set({ phone }).where(eq(users.id, target.user.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "team.member_phone_changed", entityType: "user", entityId: target.user.id, previousValue: { phone: target.user.phone }, newValue: { phone } });
    return { updated: true, phone };
  }),

  updateMemberRole: protectedProcedure.input(tenantCompanyInput.extend({ memberId: z.number().int().positive(), roleCode: managedRoleSchema })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTeamAdmin(ctx.user.id, input.tenantId, input.companyId);
    const [target] = await db.select({ membership: tenantUsers, roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.id, input.memberId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId))).limit(1);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "عضو الفريق غير موجود ضمن الشركة." });
    try { assertMemberChangeAllowed({ actorUserId: ctx.user.id, targetUserId: target.membership.userId, activeOwnerCount: await activeOwnerCount(db, input.tenantId, input.companyId) }); } catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "تعذر تغيير الدور." }); }
    const role = await resolveManagedRole(db, input.tenantId, input.roleCode);
    await db.update(tenantUsers).set({ roleId: role.id }).where(eq(tenantUsers.id, target.membership.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "team.member_role_changed", entityType: "tenant_user", entityId: target.membership.id, previousValue: { roleCode: target.roleCode }, newValue: { roleCode: role.code } });
    await createInternalNotification(db, teamRoleChangedNotification({ tenantId: input.tenantId, companyId: input.companyId, memberId: target.membership.id, recipientUserId: target.membership.userId, roleName: role.nameAr }));
    notifyProjectOwner({ event: "role_changed", subject: `العضو #${target.membership.userId}`, roleName: role.nameAr });
    return { updated: true };
  }),

  disableMember: protectedProcedure.input(tenantCompanyInput.extend({ memberId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTeamAdmin(ctx.user.id, input.tenantId, input.companyId);
    const [target] = await db.select({ membership: tenantUsers, roleCode: appRoles.code }).from(tenantUsers).leftJoin(appRoles, eq(appRoles.id, tenantUsers.roleId)).where(and(eq(tenantUsers.id, input.memberId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId))).limit(1);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "عضو الفريق غير موجود ضمن الشركة." });
    try { assertMemberChangeAllowed({ actorUserId: ctx.user.id, targetUserId: target.membership.userId, targetRoleCode: target.roleCode, activeOwnerCount: await activeOwnerCount(db, input.tenantId, input.companyId), nextStatus: "disabled" }); } catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "تعذر إلغاء الوصول." }); }
    await db.update(tenantUsers).set({ status: "disabled" }).where(eq(tenantUsers.id, target.membership.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "team.member_access_disabled", entityType: "tenant_user", entityId: target.membership.id, previousValue: { status: target.membership.status, roleCode: target.roleCode }, newValue: { status: "disabled" } });
    await createInternalNotification(db, teamAccessDisabledNotification({ tenantId: input.tenantId, companyId: input.companyId, memberId: target.membership.id, recipientUserId: target.membership.userId }));
    notifyProjectOwner({ event: "access_disabled", subject: `العضو #${target.membership.userId}` });
    return { disabled: true };
  }),

  acceptMyInvitations: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user.email) return { accepted: 0 };
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    const email = ctx.user.email.trim().toLowerCase();
    const invitations = await db.select().from(companyMemberInvitations).where(and(eq(companyMemberInvitations.email, email), eq(companyMemberInvitations.status, "pending")));
    let accepted = 0;
    for (const invitation of invitations) {
      if (invitation.expiresAt < new Date()) { await db.update(companyMemberInvitations).set({ status: "expired" }).where(eq(companyMemberInvitations.id, invitation.id)); continue; }
      const [membership] = await db.select().from(tenantUsers).where(and(eq(tenantUsers.tenantId, invitation.tenantId), eq(tenantUsers.userId, ctx.user.id))).limit(1);
      if (membership) await db.update(tenantUsers).set({ companyId: invitation.companyId, roleId: invitation.roleId, status: "active" }).where(eq(tenantUsers.id, membership.id));
      else await db.insert(tenantUsers).values({ tenantId: invitation.tenantId, companyId: invitation.companyId, userId: ctx.user.id, roleId: invitation.roleId, status: "active" });
      await db.update(companyMemberInvitations).set({ status: "accepted", acceptedByUserId: ctx.user.id }).where(eq(companyMemberInvitations.id, invitation.id));
      await appendAuditLog(db, { tenantId: invitation.tenantId, companyId: invitation.companyId, actorUserId: ctx.user.id, action: "team.invitation_accepted", entityType: "company_member_invitation", entityId: invitation.id, newValue: { email, roleId: invitation.roleId } });
      accepted += 1;
    }
    return { accepted };
  }),

  revokeInvitation: protectedProcedure.input(tenantCompanyInput.extend({ invitationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTeamAdmin(ctx.user.id, input.tenantId, input.companyId);
    const [invitation] = await db.select().from(companyMemberInvitations).where(and(eq(companyMemberInvitations.id, input.invitationId), eq(companyMemberInvitations.tenantId, input.tenantId), eq(companyMemberInvitations.companyId, input.companyId))).limit(1);
    if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "الدعوة غير موجودة." });
    await db.update(companyMemberInvitations).set({ status: "revoked" }).where(eq(companyMemberInvitations.id, invitation.id));
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "team.invitation_revoked", entityType: "company_member_invitation", entityId: invitation.id, previousValue: { status: invitation.status }, newValue: { status: "revoked", email: invitation.email } });
    return { revoked: true };
  }),

  markNotificationRead: protectedProcedure.input(tenantCompanyInput.extend({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireTeamAdmin(ctx.user.id, input.tenantId, input.companyId);
    const [notification] = await db.select({ id: internalNotifications.id }).from(internalNotifications).where(and(eq(internalNotifications.id, input.notificationId), eq(internalNotifications.tenantId, input.tenantId), eq(internalNotifications.companyId, input.companyId))).limit(1);
    if (!notification) throw new TRPCError({ code: "NOT_FOUND", message: "الإشعار غير موجود ضمن الشركة." });
    await db.update(internalNotifications).set({ status: "read", readAt: new Date() }).where(eq(internalNotifications.id, notification.id));
    return { marked: true };
  }),
});
