import { timingSafeEqual } from "node:crypto";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { verifyEmployeePassword } from "../finance/employeeAuth";
import { and, eq } from "drizzle-orm";
import { securityEvents, tenantUsers, users } from "../../drizzle/schema";
import { LEGAL_POLICY_VERSIONS } from "../../shared/productBrand";
import { decryptTotpSecret, verifyTotpCode } from "../finance/totp";

function passwordMatches(input: string, expected: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

type SecurityEventType = "login_success" | "login_failed" | "logout" | "password_changed" | "password_reset_requested" | "password_reset_completed" | "mfa_enabled" | "mfa_disabled" | "session_revoked" | "portal_access";

export async function recordSecurityEvent(event: { userId: number; eventType: SecurityEventType; ipAddress?: string; userAgent?: string; metadata?: unknown }) {
  const auditDb = await db.getDb();
  if (!auditDb) return;
  try {
    const [membership] = await auditDb.select({ tenantId: tenantUsers.tenantId, companyId: tenantUsers.companyId }).from(tenantUsers).where(and(eq(tenantUsers.userId, event.userId), eq(tenantUsers.status, "active"))).limit(1);
    if (!membership) return;
    await auditDb.insert(securityEvents).values({ ...event, tenantId: membership.tenantId, companyId: membership.companyId });
  } catch (error) {
    console.warn("[Security] audit event was skipped; authentication continues", {
      eventType: event.eventType,
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

export function localCredentialsMatch(input: { email: string; password: string }, expected: { email: string; password: string }) {
  return input.email.trim().toLowerCase() === expected.email.trim().toLowerCase() && passwordMatches(input.password, expected.password);
}

export async function loginLocalUser(ctx: Pick<CreateExpressContextOptions, "req" | "res">, input: { identifier: string; password: string; mfaCode?: string; acceptTerms?: boolean; acceptPrivacy?: boolean }) {
  if (ENV.authMode !== "local") throw new TRPCError({ code: "NOT_FOUND", message: "تسجيل الدخول المحلي غير مفعّل." });
  const identifier = input.identifier.trim().toLowerCase();
  const dbUser = (await db.getUserByEmail(identifier)) ?? (await db.getUserByUsername(identifier));
  if (!dbUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة." });

  const isAdminCredential = Boolean(ENV.localAdminEmail && ENV.localAdminPassword && dbUser.email && localCredentialsMatch({ email: dbUser.email, password: input.password }, { email: ENV.localAdminEmail, password: ENV.localAdminPassword }));
  const isEmployeeCredential = Boolean(dbUser.passwordHash && verifyEmployeePassword(input.password, dbUser.passwordHash));
  if (!isAdminCredential && !isEmployeeCredential) {
    await recordSecurityEvent({ userId: dbUser.id, eventType: "login_failed", ipAddress: ctx.req.ip, userAgent: ctx.req.headers["user-agent"] });
    throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة." });
  }

  if (dbUser.mfaEnabled) {
    const validMfa = Boolean(dbUser.mfaSecretEncrypted && input.mfaCode && /^\d{6}$/.test(input.mfaCode) && verifyTotpCode(decryptTotpSecret(dbUser.mfaSecretEncrypted), input.mfaCode));
    if (!validMfa) {
      await recordSecurityEvent({ userId: dbUser.id, eventType: "login_failed", ipAddress: ctx.req.ip, userAgent: ctx.req.headers["user-agent"], metadata: { reason: "mfa_required" } });
      throw new TRPCError({ code: "UNAUTHORIZED", message: "أدخل رمز MFA المكون من ستة أرقام." });
    }
  }

  const hasCurrentLegalConsent = dbUser.termsAcceptedVersion === LEGAL_POLICY_VERSIONS.terms && dbUser.privacyAcceptedVersion === LEGAL_POLICY_VERSIONS.privacy;
  if (!hasCurrentLegalConsent) {
    if (!input.acceptTerms || !input.acceptPrivacy) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب الموافقة على الشروط والأحكام وسياسة الخصوصية الحالية قبل متابعة الدخول." });
    const consentDb = await db.getDb();
    if (!consentDb) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "تعذر حفظ الموافقة القانونية حالياً." });
    await consentDb.update(users).set({ termsAcceptedVersion: LEGAL_POLICY_VERSIONS.terms, privacyAcceptedVersion: LEGAL_POLICY_VERSIONS.privacy, legalConsentAt: new Date(), legalConsentIp: ctx.req.ip || null }).where(eq(users.id, dbUser.id));
  }

  await recordSecurityEvent({ userId: dbUser.id, eventType: "login_success", ipAddress: ctx.req.ip, userAgent: ctx.req.headers["user-agent"], metadata: { legalConsentVersion: hasCurrentLegalConsent ? undefined : LEGAL_POLICY_VERSIONS } });

  const sessionToken = await sdk.createSessionToken(dbUser.openId, { name: dbUser.name || dbUser.email || dbUser.username || identifier, expiresInMs: ONE_YEAR_MS });
  ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
  return { id: dbUser.id, email: dbUser.email, username: dbUser.username, name: dbUser.name, role: dbUser.role, mustChangePassword: dbUser.mustChangePassword };
}

export const loginLocalAdmin = loginLocalUser;
