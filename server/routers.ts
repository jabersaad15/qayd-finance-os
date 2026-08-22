import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { loginLocalAdmin, recordSecurityEvent } from "./_core/localAuth";
import { consumePasswordResetToken, issuePasswordReset } from "./finance/passwordReset";
import { schedulingRouter } from "./routers/scheduling";
import { financeRouter } from "./routers/finance";
import { salesRouter } from "./routers/sales";
import { operationsRouter } from "./routers/operations";
import { operationsControlRouter } from "./routers/operationsControl";
import { documentsRouter } from "./routers/documents";
import { assistantRouter } from "./routers/assistant";
import { complianceRouter } from "./routers/compliance";
import { rbacRouter } from "./routers/rbac";
import { purchasesRouter } from "./routers/purchases";
import { auditRouter } from "./routers/audit";
import { teamRouter } from "./routers/team";
import { customerPortalRouter } from "./routers/customerPortal";
import { approvalsRouter } from "./routers/approvals";
import { securityRouter } from "./routers/security";
import { kpiRouter } from "./routers/kpi";
import { executiveRouter } from "./routers/executive";
import { executiveAssistantRouter } from "./routers/executiveAssistant";
import { ceoRouter } from "./routers/ceo";
import { companyAdminRouter } from "./routers/companyAdmin";
import { administrativeRouter } from "./routers/administrative";
import { subscriptionsRouter } from "./routers/subscriptions";
import { zatcaRouter } from "./routers/zatca";
import { getDb, getUserByOpenId } from "./db";
import { hashEmployeePassword, verifyEmployeePassword } from "./finance/employeeAuth";

const publicUser = (user: typeof import("../drizzle/schema").users.$inferSelect | null) => user ? ({ id: user.id, openId: user.openId, name: user.name, email: user.email, phone: user.phone, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword, mfaEnabled: user.mfaEnabled, termsAcceptedVersion: user.termsAcceptedVersion, privacyAcceptedVersion: user.privacyAcceptedVersion, legalConsentAt: user.legalConsentAt, loginMethod: user.loginMethod, createdAt: user.createdAt, updatedAt: user.updatedAt, lastSignedIn: user.lastSignedIn }) : null;

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => publicUser(opts.ctx.user)),
    localLogin: publicProcedure.input(z.object({ identifier: z.string().min(2).max(320), password: z.string().min(1).max(512), mfaCode: z.string().regex(/^\d{6}$/).optional(), acceptTerms: z.boolean().optional(), acceptPrivacy: z.boolean().optional() })).mutation(({ ctx, input }) => loginLocalAdmin(ctx, input)),
    requestPasswordReset: publicProcedure.input(z.object({ identifier: z.string().trim().min(2).max(320) })).mutation(async ({ ctx, input }) => {
      try {
        await issuePasswordReset({ identifier: input.identifier, requestIp: ctx.req.ip, publicAppUrl: process.env.PUBLIC_APP_URL });
      } catch {
        console.warn("[Auth] Password reset request was not dispatched");
      }
      return { accepted: true } as const;
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(32).max(128), password: z.string().min(8).max(128) })).mutation(async ({ ctx, input }) => {
      const user = await consumePasswordResetToken(input.token);
      if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "رابط الاستعادة غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "تعذر تحديث كلمة المرور حالياً." });
      await db.update(users).set({ passwordHash: hashEmployeePassword(input.password), mustChangePassword: false, loginMethod: "local" }).where(eq(users.id, user.id));
      await recordSecurityEvent({ userId: user.id, eventType: "password_reset_completed", ipAddress: ctx.req.ip, userAgent: ctx.req.headers["user-agent"] });
      return { changed: true } as const;
    }),
    changePassword: publicProcedure.input(z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(8).max(128) })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول أولاً." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود." });
      if (user.passwordHash && !user.mustChangePassword && (!input.currentPassword || !verifyEmployeePassword(input.currentPassword, user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة." });
      await db.update(users).set({ passwordHash: hashEmployeePassword(input.newPassword), mustChangePassword: false, loginMethod: "local" }).where(eq(users.id, user.id));
      return { changed: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  scheduling: schedulingRouter,
  finance: financeRouter,
  sales: salesRouter,
  operations: operationsRouter,
  operationsControl: operationsControlRouter,
  documents: documentsRouter,
  assistant: assistantRouter,
  compliance: complianceRouter,
  rbac: rbacRouter,
  purchases: purchasesRouter,
  audit: auditRouter,
  team: teamRouter,
  customerPortal: customerPortalRouter,
  approvals: approvalsRouter,
  security: securityRouter,
  kpi: kpiRouter,
  executive: executiveRouter,
  executiveAssistant: executiveAssistantRouter,
  ceo: ceoRouter,
  companyAdmin: companyAdminRouter,
  administrative: administrativeRouter,
  subscriptions: subscriptionsRouter,
  zatca: zatcaRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
