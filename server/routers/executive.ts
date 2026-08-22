import { and, desc, eq, inArray, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appRoles, companies, executiveAssignments, executiveWeeklyReports, salesWeeklyRepNotes, tenantUsers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const assistantRoles = ["ceo_assistant", "executive_assistant", "super_admin"] as const;
const leadershipRoles = ["super_admin", "general_manager"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;
const assignmentStatuses = ["planned", "in_progress", "blocked", "completed", "cancelled"] as const;
const reportStatuses = ["draft", "submitted", "reviewed"] as const;
const noteViewerRoles = ["ceo_assistant", "executive_assistant", "super_admin", "general_manager"] as const;
const salesRepRole = "sales_rep";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function requireActor(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [actor] = await db.select({ membership: tenantUsers, role: appRoles, company: companies }).from(tenantUsers).leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id)).innerJoin(companies, eq(tenantUsers.companyId, companies.id)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!actor) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية فعالة في الشركة المطلوبة." });
  return { db, roleCode: actor.role?.code ?? "read_only" };
}

function isOneOf(roleCode: string, roles: readonly string[]) { return roles.includes(roleCode); }
function assertDateRange(start: string, end: string) { if (end < start) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ نهاية التقرير يجب أن يكون بعد تاريخ بدايته." }); }

async function assertAssignee(db: Db, input: { tenantId: number; companyId: number; userId: number }) {
  const [member] = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.userId, input.userId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "المسؤول المحدد ليس عضواً نشطاً في الشركة." });
}

export const executiveRouter = router({
  dashboard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input.tenantId, input.companyId);
    if (!isOneOf(roleCode, [...assistantRoles, ...leadershipRoles])) throw new TRPCError({ code: "FORBIDDEN", message: "لوحة المتابعة التنفيذية متاحة للمساعد والرئيس التنفيذي والإدارة المخولة فقط." });
    const assignmentFilter = isOneOf(roleCode, leadershipRoles) ? undefined : or(eq(executiveAssignments.assignedToUserId, ctx.user.id), eq(executiveAssignments.createdByUserId, ctx.user.id));
    const reportFilter = isOneOf(roleCode, leadershipRoles) ? undefined : eq(executiveWeeklyReports.submittedByUserId, ctx.user.id);
    const [assignments, reports, members] = await Promise.all([
      db.select({ assignment: executiveAssignments, assignee: users }).from(executiveAssignments).innerJoin(users, eq(executiveAssignments.assignedToUserId, users.id)).where(and(eq(executiveAssignments.tenantId, input.tenantId), eq(executiveAssignments.companyId, input.companyId), assignmentFilter)).orderBy(desc(executiveAssignments.dueDate), desc(executiveAssignments.updatedAt)),
      db.select({ report: executiveWeeklyReports, author: users }).from(executiveWeeklyReports).innerJoin(users, eq(executiveWeeklyReports.submittedByUserId, users.id)).where(and(eq(executiveWeeklyReports.tenantId, input.tenantId), eq(executiveWeeklyReports.companyId, input.companyId), reportFilter)).orderBy(desc(executiveWeeklyReports.weekStart)),
      isOneOf(roleCode, assistantRoles) ? db.select({ user: users, membership: tenantUsers, role: appRoles }).from(tenantUsers).innerJoin(users, eq(tenantUsers.userId, users.id)).leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id)).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))) : Promise.resolve([]),
    ]);
    return { roleCode, assignments, reports, members };
  }),

  createAssignment: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), title: z.string().trim().min(2).max(255), description: z.string().trim().max(5000).optional(), assignedToUserId: z.number().int().positive(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), priority: z.enum(priorities).default("normal") })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input.tenantId, input.companyId);
    if (!isOneOf(roleCode, assistantRoles)) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء التكليفات متاح لمساعد الرئيس التنفيذي والرئيس التنفيذي فقط." });
    await assertAssignee(db, { tenantId: input.tenantId, companyId: input.companyId, userId: input.assignedToUserId });
    const result = await db.insert(executiveAssignments).values({ tenantId: input.tenantId, companyId: input.companyId, title: input.title, description: input.description || null, assignedToUserId: input.assignedToUserId, createdByUserId: ctx.user.id, dueDate: new Date(`${input.dueDate}T00:00:00.000Z`), priority: input.priority });
    return { id: Number(result[0].insertId) };
  }),

  updateAssignment: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), assignmentId: z.number().int().positive(), status: z.enum(assignmentStatuses).optional(), latestUpdate: z.string().trim().max(5000).optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), assignedToUserId: z.number().int().positive().optional(), priority: z.enum(priorities).optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input.tenantId, input.companyId);
    const [assignment] = await db.select().from(executiveAssignments).where(and(eq(executiveAssignments.id, input.assignmentId), eq(executiveAssignments.tenantId, input.tenantId), eq(executiveAssignments.companyId, input.companyId))).limit(1);
    if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "التكليف غير موجود." });
    const canEdit = isOneOf(roleCode, leadershipRoles) || (["ceo_assistant", "executive_assistant"].includes(roleCode) && (assignment.assignedToUserId === ctx.user.id || assignment.createdByUserId === ctx.user.id));
    if (!canEdit) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعديل هذا التكليف خارج نطاق متابعتك." });
    if (input.assignedToUserId) await assertAssignee(db, { tenantId: input.tenantId, companyId: input.companyId, userId: input.assignedToUserId });
    const { assignmentId: _assignmentId, tenantId: _tenantId, companyId: _companyId, dueDate, ...rawChanges } = input;
    const changes = { ...rawChanges, ...(dueDate ? { dueDate: new Date(`${dueDate}T00:00:00.000Z`) } : {}) };
    await db.update(executiveAssignments).set({ ...changes, latestUpdate: changes.latestUpdate ?? assignment.latestUpdate, completedAt: changes.status === "completed" ? new Date() : changes.status ? null : assignment.completedAt }).where(eq(executiveAssignments.id, assignment.id));
    return { updated: true } as const;
  }),

  saveWeeklyReport: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), reportId: z.number().int().positive().optional(), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), summary: z.string().trim().min(2).max(10000), achievements: z.string().trim().max(10000).optional(), blockers: z.string().trim().max(10000).optional(), decisionsNeeded: z.string().trim().max(10000).optional(), nextWeekPlan: z.string().trim().max(10000).optional(), status: z.enum(reportStatuses).default("draft") })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input.tenantId, input.companyId);
    if (!isOneOf(roleCode, assistantRoles)) throw new TRPCError({ code: "FORBIDDEN", message: "إعداد التقرير الأسبوعي متاح لمساعد الرئيس التنفيذي والرئيس التنفيذي فقط." });
    assertDateRange(input.weekStart, input.weekEnd);
    const values = { weekStart: new Date(`${input.weekStart}T00:00:00.000Z`), weekEnd: new Date(`${input.weekEnd}T00:00:00.000Z`), summary: input.summary, achievements: input.achievements || null, blockers: input.blockers || null, decisionsNeeded: input.decisionsNeeded || null, nextWeekPlan: input.nextWeekPlan || null, status: input.status } as const;
    if (input.reportId) {
      const [existing] = await db.select().from(executiveWeeklyReports).where(and(eq(executiveWeeklyReports.id, input.reportId), eq(executiveWeeklyReports.tenantId, input.tenantId), eq(executiveWeeklyReports.companyId, input.companyId), eq(executiveWeeklyReports.submittedByUserId, ctx.user.id))).limit(1);
      if (!existing || existing.status === "reviewed") throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تعديل التقرير بعد مراجعته." });
      await db.update(executiveWeeklyReports).set(values).where(eq(executiveWeeklyReports.id, existing.id));
      return { id: existing.id, updated: true } as const;
    }
    const result = await db.insert(executiveWeeklyReports).values({ tenantId: input.tenantId, companyId: input.companyId, submittedByUserId: ctx.user.id, ...values });
    return { id: Number(result[0].insertId), updated: false } as const;
  }),

  reviewWeeklyReport: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), reportId: z.number().int().positive(), status: z.enum(["submitted", "reviewed"]), reviewNote: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input.tenantId, input.companyId);
    if (!isOneOf(roleCode, leadershipRoles)) throw new TRPCError({ code: "FORBIDDEN", message: "مراجعة التقارير الأسبوعية متاحة للرئيس التنفيذي والإدارة المخولة فقط." });
    const [report] = await db.select().from(executiveWeeklyReports).where(and(eq(executiveWeeklyReports.id, input.reportId), eq(executiveWeeklyReports.tenantId, input.tenantId), eq(executiveWeeklyReports.companyId, input.companyId))).limit(1);
    if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "التقرير الأسبوعي غير موجود." });
    await db.update(executiveWeeklyReports).set({ status: input.status, reviewedByUserId: ctx.user.id, reviewedAt: new Date() }).where(eq(executiveWeeklyReports.id, report.id));
    return { reviewed: true, reviewNote: input.reviewNote || null } as const;
  }),

  listSalesWeeklyRepNotes: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), salesRepUserId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input.tenantId, input.companyId);
    if (!isOneOf(roleCode, [...noteViewerRoles, salesRepRole])) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية قراءة توجيهات المبيعات." });
    const targetUserId = roleCode === salesRepRole ? ctx.user.id : input.salesRepUserId;
    const notes = await db.select({ note: salesWeeklyRepNotes, salesRep: users }).from(salesWeeklyRepNotes).innerJoin(users, eq(salesWeeklyRepNotes.salesRepUserId, users.id)).where(and(eq(salesWeeklyRepNotes.tenantId, input.tenantId), eq(salesWeeklyRepNotes.companyId, input.companyId), eq(salesWeeklyRepNotes.weekStart, new Date(`${input.weekStart}T00:00:00.000Z`)), targetUserId ? eq(salesWeeklyRepNotes.salesRepUserId, targetUserId) : undefined)).orderBy(desc(salesWeeklyRepNotes.updatedAt));
    return notes;
  }),

  saveSalesWeeklyRepNote: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), salesRepUserId: z.number().int().positive(), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().trim().min(1, "اكتب الملاحظة أو التوجيه أولاً.").max(5000) })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input.tenantId, input.companyId);
    if (!isOneOf(roleCode, noteViewerRoles)) throw new TRPCError({ code: "FORBIDDEN", message: "حفظ التوجيهات متاح لمهند والرئيس التنفيذي والإدارة المخولة فقط." });
    assertDateRange(input.weekStart, input.weekEnd);
    const [rep] = await db.select({ membership: tenantUsers, role: appRoles }).from(tenantUsers).leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id)).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.userId, input.salesRepUserId), eq(tenantUsers.status, "active"))).limit(1);
    if (!rep || rep.role?.code !== salesRepRole) throw new TRPCError({ code: "BAD_REQUEST", message: "المستخدم المحدد ليس ممثل مبيعات نشطاً." });
    await db.insert(salesWeeklyRepNotes).values({ tenantId: input.tenantId, companyId: input.companyId, salesRepUserId: input.salesRepUserId, authorUserId: ctx.user.id, weekStart: new Date(`${input.weekStart}T00:00:00.000Z`), weekEnd: new Date(`${input.weekEnd}T00:00:00.000Z`), note: input.note }).onDuplicateKeyUpdate({ set: { authorUserId: ctx.user.id, weekEnd: new Date(`${input.weekEnd}T00:00:00.000Z`), note: input.note } });
    return { saved: true } as const;
  }),
});
