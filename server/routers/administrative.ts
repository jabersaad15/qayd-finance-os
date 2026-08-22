import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { appRoles, administrativeActivityTimeline, administrativeCorrespondence, administrativeDocuments, administrativeMeetings, administrativeReminders, administrativeRequests, administrativeTasks, companies, documents, tenantUsers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const assistantRoles = ["ceo_assistant", "company_admin", "super_admin", "general_manager"] as const;
const leadershipRoles = ["company_admin", "super_admin", "general_manager", "finance_manager", "cfo", "sales"] as const;
const taskStatuses = ["new", "in_progress", "waiting", "completed", "cancelled"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;
const meetingStatuses = ["planned", "held", "cancelled"] as const;
const correspondenceTypes = ["letter", "email", "internal", "external", "circular"] as const;
const correspondenceStatuses = ["draft", "review", "approved", "sent", "closed"] as const;
const requestTypes = ["letter", "appointment", "meeting", "document", "visit", "contact", "file", "follow_up"] as const;
const reminderStatuses = ["open", "completed", "cancelled"] as const;
const documentScopes = ["general", "department", "confidential", "executive"] as const;

type ScopeInput = { tenantId: number; companyId: number };

async function requireActor(userId: number, input: ScopeInput) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [actor] = await db.select({ membership: tenantUsers, role: appRoles, company: companies }).from(tenantUsers).leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id)).innerJoin(companies, eq(tenantUsers.companyId, companies.id)).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!actor) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية فعالة في الشركة المطلوبة." });
  return { db, roleCode: actor.role?.code ?? "read_only" };
}

function isAny(roleCode: string, roles: readonly string[]) { return roles.includes(roleCode); }
function dateValue(value?: string | null) { return value ? new Date(`${value}T00:00:00.000Z`) : null; }
async function assertMember(db: Awaited<ReturnType<typeof getDb>>, input: ScopeInput & { userId: number }) {
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const [member] = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.userId, input.userId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "المستخدم المحدد ليس عضواً نشطاً في الشركة." });
}
async function appendTimeline(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, input: ScopeInput & { entityType: string; entityId: number; action: string; description: string; actorUserId: number }) {
  await db.insert(administrativeActivityTimeline).values(input);
}

export const administrativeRouter = router({
  dashboard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    const personalScope = roleCode === "ceo_assistant";
    const assignmentScope = personalScope ? or(eq(administrativeTasks.assignedToUserId, ctx.user.id), eq(administrativeTasks.createdByUserId, ctx.user.id)) : undefined;
    const meetingScope = personalScope ? eq(administrativeMeetings.organizerUserId, ctx.user.id) : undefined;
    const correspondenceScope = personalScope ? eq(administrativeCorrespondence.assignedToUserId, ctx.user.id) : undefined;
    const requestScope = personalScope ? or(eq(administrativeRequests.requestedByUserId, ctx.user.id), eq(administrativeRequests.assignedToUserId, ctx.user.id)) : undefined;
    const reminderScope = personalScope ? eq(administrativeReminders.assignedToUserId, ctx.user.id) : undefined;
    const [tasks, meetings, correspondence, requests, reminders, members] = await Promise.all([
      db.select({ task: administrativeTasks, assignee: users }).from(administrativeTasks).innerJoin(users, eq(administrativeTasks.assignedToUserId, users.id)).where(and(eq(administrativeTasks.tenantId, input.tenantId), eq(administrativeTasks.companyId, input.companyId), assignmentScope)).orderBy(desc(administrativeTasks.dueDate), desc(administrativeTasks.updatedAt)).limit(100),
      db.select({ meeting: administrativeMeetings, organizer: users }).from(administrativeMeetings).innerJoin(users, eq(administrativeMeetings.organizerUserId, users.id)).where(and(eq(administrativeMeetings.tenantId, input.tenantId), eq(administrativeMeetings.companyId, input.companyId), meetingScope)).orderBy(desc(administrativeMeetings.meetingDate), desc(administrativeMeetings.startTime)).limit(100),
      db.select({ correspondence: administrativeCorrespondence, assignee: users }).from(administrativeCorrespondence).innerJoin(users, eq(administrativeCorrespondence.assignedToUserId, users.id)).where(and(eq(administrativeCorrespondence.tenantId, input.tenantId), eq(administrativeCorrespondence.companyId, input.companyId), correspondenceScope)).orderBy(desc(administrativeCorrespondence.followUpDate), desc(administrativeCorrespondence.updatedAt)).limit(100),
      db.select({ request: administrativeRequests, assignee: users }).from(administrativeRequests).leftJoin(users, eq(administrativeRequests.assignedToUserId, users.id)).where(and(eq(administrativeRequests.tenantId, input.tenantId), eq(administrativeRequests.companyId, input.companyId), requestScope)).orderBy(desc(administrativeRequests.deadline), desc(administrativeRequests.updatedAt)).limit(100),
      db.select({ reminder: administrativeReminders, assignee: users }).from(administrativeReminders).innerJoin(users, eq(administrativeReminders.assignedToUserId, users.id)).where(and(eq(administrativeReminders.tenantId, input.tenantId), eq(administrativeReminders.companyId, input.companyId), reminderScope)).orderBy(desc(administrativeReminders.dueAt)).limit(100),
      db.select({ user: users, membership: tenantUsers, role: appRoles }).from(tenantUsers).innerJoin(users, eq(tenantUsers.userId, users.id)).leftJoin(appRoles, eq(tenantUsers.roleId, appRoles.id)).where(and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.companyId, input.companyId), eq(tenantUsers.status, "active"))).orderBy(users.name),
    ]);
    return { roleCode, tasks, meetings, correspondence, requests, reminders, members };
  }),

  createTask: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), title: z.string().trim().min(2).max(255), description: z.string().trim().max(5000).optional(), status: z.enum(taskStatuses).default("new"), priority: z.enum(priorities).default("normal"), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), assignedToUserId: z.number().int().positive(), relatedEntityType: z.string().trim().max(64).optional(), relatedEntityId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    if (!isAny(roleCode, [...assistantRoles, "finance_manager", "cfo", "sales"])) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إنشاء مهمة إدارية." });
    await assertMember(db, { ...input, userId: input.assignedToUserId });
    const result = await db.insert(administrativeTasks).values({ tenantId: input.tenantId, companyId: input.companyId, title: input.title, description: input.description || null, status: input.status, priority: input.priority, dueDate: dateValue(input.dueDate), assignedToUserId: input.assignedToUserId, createdByUserId: ctx.user.id, relatedEntityType: input.relatedEntityType || null, relatedEntityId: input.relatedEntityId || null });
    const id = Number(result[0].insertId);
    await appendTimeline(db, { tenantId: input.tenantId, companyId: input.companyId, entityType: "administrative_task", entityId: id, action: "created", description: "تم إنشاء المهمة الإدارية.", actorUserId: ctx.user.id });
    return { id };
  }),

  updateTask: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), taskId: z.number().int().positive(), status: z.enum(taskStatuses).optional(), notes: z.string().trim().max(5000).optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireActor(ctx.user.id, input);
    const [task] = await db.select().from(administrativeTasks).where(and(eq(administrativeTasks.id, input.taskId), eq(administrativeTasks.tenantId, input.tenantId), eq(administrativeTasks.companyId, input.companyId), or(eq(administrativeTasks.assignedToUserId, ctx.user.id), eq(administrativeTasks.createdByUserId, ctx.user.id)))).limit(1);
    if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "المهمة غير موجودة أو خارج نطاق متابعتك." });
    await db.update(administrativeTasks).set({ status: input.status ?? task.status, notes: input.notes ?? task.notes, dueDate: input.dueDate ? dateValue(input.dueDate) : task.dueDate }).where(eq(administrativeTasks.id, task.id));
    await appendTimeline(db, { tenantId: input.tenantId, companyId: input.companyId, entityType: "administrative_task", entityId: task.id, action: "updated", description: input.status ? `تم تحديث الحالة إلى ${input.status}.` : "تم تحديث المهمة.", actorUserId: ctx.user.id });
    return { updated: true } as const;
  }),

  createMeeting: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), title: z.string().trim().min(2).max(255), meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().max(8).optional(), endTime: z.string().max(8).optional(), location: z.string().trim().max(512).optional(), agenda: z.string().trim().max(10000).optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    if (!isAny(roleCode, assistantRoles)) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء الاجتماعات متاح للمساعد الإداري والإدارة المخولة فقط." });
    const result = await db.insert(administrativeMeetings).values({ tenantId: input.tenantId, companyId: input.companyId, title: input.title, meetingDate: dateValue(input.meetingDate)!, startTime: input.startTime || null, endTime: input.endTime || null, location: input.location || null, agenda: input.agenda || null, organizerUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await appendTimeline(db, { tenantId: input.tenantId, companyId: input.companyId, entityType: "administrative_meeting", entityId: id, action: "created", description: "تم إنشاء اجتماع إداري.", actorUserId: ctx.user.id });
    return { id };
  }),

  saveMinutes: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), meetingId: z.number().int().positive(), minutes: z.string().trim().min(2).max(20000), status: z.enum(meetingStatuses).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireActor(ctx.user.id, input);
    const [meeting] = await db.select().from(administrativeMeetings).where(and(eq(administrativeMeetings.id, input.meetingId), eq(administrativeMeetings.tenantId, input.tenantId), eq(administrativeMeetings.companyId, input.companyId), eq(administrativeMeetings.organizerUserId, ctx.user.id))).limit(1);
    if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "الاجتماع غير موجود أو خارج نطاقك." });
    await db.update(administrativeMeetings).set({ minutes: input.minutes, status: input.status ?? "held" }).where(eq(administrativeMeetings.id, meeting.id));
    await appendTimeline(db, { tenantId: input.tenantId, companyId: input.companyId, entityType: "administrative_meeting", entityId: meeting.id, action: "minutes_added", description: "تم تسجيل محضر الاجتماع.", actorUserId: ctx.user.id });
    return { updated: true } as const;
  }),

  createCorrespondence: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), title: z.string().trim().min(2).max(255), counterparty: z.string().trim().max(255).optional(), contactName: z.string().trim().max(255).optional(), correspondenceType: z.enum(correspondenceTypes).default("internal"), followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), notes: z.string().trim().max(10000).optional(), assignedToUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    if (!isAny(roleCode, [...assistantRoles, "finance_manager", "cfo", "sales"])) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إنشاء مراسلة إدارية." });
    await assertMember(db, { ...input, userId: input.assignedToUserId });
    const result = await db.insert(administrativeCorrespondence).values({ tenantId: input.tenantId, companyId: input.companyId, title: input.title, counterparty: input.counterparty || null, contactName: input.contactName || null, correspondenceType: input.correspondenceType, assignedToUserId: input.assignedToUserId, followUpDate: dateValue(input.followUpDate), notes: input.notes || null, createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await appendTimeline(db, { tenantId: input.tenantId, companyId: input.companyId, entityType: "administrative_correspondence", entityId: id, action: "created", description: "تم إنشاء مراسلة إدارية.", actorUserId: ctx.user.id });
    return { id };
  }),

  updateCorrespondence: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), correspondenceId: z.number().int().positive(), status: z.enum(correspondenceStatuses), notes: z.string().trim().max(10000).optional() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireActor(ctx.user.id, input);
    const [item] = await db.select().from(administrativeCorrespondence).where(and(eq(administrativeCorrespondence.id, input.correspondenceId), eq(administrativeCorrespondence.tenantId, input.tenantId), eq(administrativeCorrespondence.companyId, input.companyId), eq(administrativeCorrespondence.assignedToUserId, ctx.user.id))).limit(1);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "المراسلة غير موجودة أو خارج نطاقك." });
    if (["approved", "sent"].includes(input.status)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يستطيع المساعد الإداري اعتماد المراسلات الحساسة؛ أرسلها للمراجعة." });
    await db.update(administrativeCorrespondence).set({ status: input.status, notes: input.notes ?? item.notes }).where(eq(administrativeCorrespondence.id, item.id));
    await appendTimeline(db, { tenantId: input.tenantId, companyId: input.companyId, entityType: "administrative_correspondence", entityId: item.id, action: "status_changed", description: `تغيرت حالة المراسلة إلى ${input.status}.`, actorUserId: ctx.user.id });
    return { updated: true } as const;
  }),

  createRequest: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), requestType: z.enum(requestTypes), description: z.string().trim().min(2).max(10000), priority: z.enum(priorities).default("normal"), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), assignedToUserId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    if (!isAny(roleCode, [...assistantRoles, "finance_manager", "cfo", "sales"])) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إنشاء طلب إداري." });
    if (input.assignedToUserId) await assertMember(db, { ...input, userId: input.assignedToUserId });
    const result = await db.insert(administrativeRequests).values({ tenantId: input.tenantId, companyId: input.companyId, requestType: input.requestType, description: input.description, priority: input.priority, deadline: dateValue(input.deadline), requestedByUserId: ctx.user.id, assignedToUserId: input.assignedToUserId || null });
    return { id: Number(result[0].insertId) };
  }),

  registerDocument: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), documentId: z.number().int().positive(), title: z.string().trim().min(2).max(255), description: z.string().trim().max(5000).optional(), accessScope: z.enum(documentScopes).default("general"), department: z.string().trim().max(128).optional() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    if (!isAny(roleCode, assistantRoles)) throw new TRPCError({ code: "FORBIDDEN", message: "تسجيل مستند إداري متاح للمساعد الإداري والإدارة المخولة فقط." });
    const [source] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId), eq(documents.companyId, input.companyId))).limit(1);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "ملف المستند غير موجود ضمن الشركة." });
    const result = await db.insert(administrativeDocuments).values({ tenantId: input.tenantId, companyId: input.companyId, documentId: input.documentId, title: input.title, description: input.description || null, accessScope: input.accessScope, department: input.department || null, createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await appendTimeline(db, { tenantId: input.tenantId, companyId: input.companyId, entityType: "administrative_document", entityId: id, action: "registered", description: `تم تسجيل المستند ضمن نطاق ${input.accessScope}.`, actorUserId: ctx.user.id });
    return { id };
  }),

  listDocuments: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), query: z.string().trim().max(120).optional() })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    const scopeFilter = roleCode === "ceo_assistant" ? or(eq(administrativeDocuments.accessScope, "general"), eq(administrativeDocuments.accessScope, "department")) : undefined;
    const searchFilter = input.query ? or(like(administrativeDocuments.title, `%${input.query}%`), like(administrativeDocuments.description, `%${input.query}%`), like(administrativeDocuments.department, `%${input.query}%`)) : undefined;
    return db.select({ administrativeDocument: administrativeDocuments, sourceDocument: documents }).from(administrativeDocuments).innerJoin(documents, eq(administrativeDocuments.documentId, documents.id)).where(and(eq(administrativeDocuments.tenantId, input.tenantId), eq(administrativeDocuments.companyId, input.companyId), scopeFilter, searchFilter)).orderBy(desc(administrativeDocuments.createdAt)).limit(100);
  }),

  search: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), query: z.string().trim().min(2).max(120) })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    const term = `%${input.query}%`;
    const assistantScope = roleCode === "ceo_assistant";
    const [tasks, meetings, correspondence, requests, adminDocs] = await Promise.all([
      db.select({ id: administrativeTasks.id, title: administrativeTasks.title, type: administrativeTasks.relatedEntityType }).from(administrativeTasks).where(and(eq(administrativeTasks.tenantId, input.tenantId), eq(administrativeTasks.companyId, input.companyId), or(like(administrativeTasks.title, term), like(administrativeTasks.description, term)), assistantScope ? or(eq(administrativeTasks.assignedToUserId, ctx.user.id), eq(administrativeTasks.createdByUserId, ctx.user.id)) : undefined)).limit(25),
      db.select({ id: administrativeMeetings.id, title: administrativeMeetings.title, type: administrativeMeetings.status }).from(administrativeMeetings).where(and(eq(administrativeMeetings.tenantId, input.tenantId), eq(administrativeMeetings.companyId, input.companyId), or(like(administrativeMeetings.title, term), like(administrativeMeetings.agenda, term), like(administrativeMeetings.minutes, term)), assistantScope ? eq(administrativeMeetings.organizerUserId, ctx.user.id) : undefined)).limit(25),
      db.select({ id: administrativeCorrespondence.id, title: administrativeCorrespondence.title, type: administrativeCorrespondence.status }).from(administrativeCorrespondence).where(and(eq(administrativeCorrespondence.tenantId, input.tenantId), eq(administrativeCorrespondence.companyId, input.companyId), or(like(administrativeCorrespondence.title, term), like(administrativeCorrespondence.counterparty, term), like(administrativeCorrespondence.contactName, term)), assistantScope ? eq(administrativeCorrespondence.assignedToUserId, ctx.user.id) : undefined)).limit(25),
      db.select({ id: administrativeRequests.id, title: administrativeRequests.description, type: administrativeRequests.status }).from(administrativeRequests).where(and(eq(administrativeRequests.tenantId, input.tenantId), eq(administrativeRequests.companyId, input.companyId), like(administrativeRequests.description, term), assistantScope ? or(eq(administrativeRequests.requestedByUserId, ctx.user.id), eq(administrativeRequests.assignedToUserId, ctx.user.id)) : undefined)).limit(25),
      db.select({ id: administrativeDocuments.id, title: administrativeDocuments.title, type: administrativeDocuments.accessScope }).from(administrativeDocuments).where(and(eq(administrativeDocuments.tenantId, input.tenantId), eq(administrativeDocuments.companyId, input.companyId), like(administrativeDocuments.title, term), assistantScope ? or(eq(administrativeDocuments.accessScope, "general"), eq(administrativeDocuments.accessScope, "department")) : undefined)).limit(25),
    ]);
    return { tasks, meetings, correspondence, requests, documents: adminDocs };
  }),

  report: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    const assistantScope = roleCode === "ceo_assistant";
    const [tasks, requests, correspondence, meetings, adminDocs] = await Promise.all([
      db.select().from(administrativeTasks).where(and(eq(administrativeTasks.tenantId, input.tenantId), eq(administrativeTasks.companyId, input.companyId), assistantScope ? or(eq(administrativeTasks.assignedToUserId, ctx.user.id), eq(administrativeTasks.createdByUserId, ctx.user.id)) : undefined)),
      db.select().from(administrativeRequests).where(and(eq(administrativeRequests.tenantId, input.tenantId), eq(administrativeRequests.companyId, input.companyId), assistantScope ? or(eq(administrativeRequests.requestedByUserId, ctx.user.id), eq(administrativeRequests.assignedToUserId, ctx.user.id)) : undefined)),
      db.select().from(administrativeCorrespondence).where(and(eq(administrativeCorrespondence.tenantId, input.tenantId), eq(administrativeCorrespondence.companyId, input.companyId), assistantScope ? eq(administrativeCorrespondence.assignedToUserId, ctx.user.id) : undefined)),
      db.select().from(administrativeMeetings).where(and(eq(administrativeMeetings.tenantId, input.tenantId), eq(administrativeMeetings.companyId, input.companyId), assistantScope ? eq(administrativeMeetings.organizerUserId, ctx.user.id) : undefined)),
      db.select().from(administrativeDocuments).where(and(eq(administrativeDocuments.tenantId, input.tenantId), eq(administrativeDocuments.companyId, input.companyId), assistantScope ? or(eq(administrativeDocuments.accessScope, "general"), eq(administrativeDocuments.accessScope, "department")) : undefined)),
    ]);
    return { roleCode, totals: { tasks: tasks.length, openTasks: tasks.filter((item) => !["completed", "cancelled"].includes(item.status)).length, requests: requests.length, openRequests: requests.filter((item) => !["completed", "cancelled"].includes(item.status)).length, correspondence: correspondence.length, pendingCorrespondence: correspondence.filter((item) => !["closed", "sent"].includes(item.status)).length, meetings: meetings.length, documents: adminDocs.length } };
  }),

  createReminder: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), title: z.string().trim().min(2).max(255), dueAt: z.string().datetime(), priority: z.enum(priorities).default("normal"), assignedToUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    if (!isAny(roleCode, [...assistantRoles, "finance_manager", "cfo", "sales"])) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إنشاء تذكير إداري." });
    await assertMember(db, { ...input, userId: input.assignedToUserId });
    const result = await db.insert(administrativeReminders).values({ tenantId: input.tenantId, companyId: input.companyId, title: input.title, dueAt: new Date(input.dueAt), priority: input.priority, assignedToUserId: input.assignedToUserId, createdByUserId: ctx.user.id });
    return { id: Number(result[0].insertId) };
  }),

  timeline: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), entityType: z.string().trim().max(64), entityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db, roleCode } = await requireActor(ctx.user.id, input);
    const rows = await db.select({ event: administrativeActivityTimeline, actor: users }).from(administrativeActivityTimeline).innerJoin(users, eq(administrativeActivityTimeline.actorUserId, users.id)).where(and(eq(administrativeActivityTimeline.tenantId, input.tenantId), eq(administrativeActivityTimeline.companyId, input.companyId), eq(administrativeActivityTimeline.entityType, input.entityType), eq(administrativeActivityTimeline.entityId, input.entityId))).orderBy(desc(administrativeActivityTimeline.createdAt));
    if (roleCode === "ceo_assistant") return rows;
    if (isAny(roleCode, [...leadershipRoles, "ceo_assistant"])) return rows;
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية قراءة السجل الإداري." });
  }),
});

export type AdministrativeRouter = typeof administrativeRouter;

export const administrativeRoleCodes = { assistantRoles, leadershipRoles };
export const administrativeStatus = { taskStatuses, priorities, meetingStatuses, correspondenceTypes, correspondenceStatuses, requestTypes, reminderStatuses };
