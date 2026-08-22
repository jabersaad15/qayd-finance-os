import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { securityEvents, users } from "../../drizzle/schema";
import { createTotpSecret, decryptTotpSecret, encryptTotpSecret, totpUri, verifyTotpCode } from "../finance/totp";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const securityRouter = router({
  enableMfa: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    const secret = createTotpSecret();
    await db.update(users).set({ mfaSecretEncrypted: encryptTotpSecret(secret), mfaEnabled: false }).where(eq(users.id, ctx.user.id));
    return { secret, otpauthUri: totpUri(secret, ctx.user.email ?? ctx.user.name ?? `user-${ctx.user.id}`) };
  }),

  confirmMfa: protectedProcedure.input(z.object({ code: z.string().regex(/^\d{6}$/) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    const [user] = await db.select({ mfaSecretEncrypted: users.mfaSecretEncrypted }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user?.mfaSecretEncrypted || !verifyTotpCode(decryptTotpSecret(user.mfaSecretEncrypted), input.code)) throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز MFA غير صحيح." });
    await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, ctx.user.id));
    await db.insert(securityEvents).values({ userId: ctx.user.id, eventType: "mfa_enabled" });
    return { enabled: true } as const;
  }),

  disableMfa: protectedProcedure.input(z.object({ code: z.string().regex(/^\d{6}$/) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    const [user] = await db.select({ mfaSecretEncrypted: users.mfaSecretEncrypted }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user?.mfaSecretEncrypted || !verifyTotpCode(decryptTotpSecret(user.mfaSecretEncrypted), input.code)) throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز MFA غير صحيح." });
    await db.update(users).set({ mfaEnabled: false, mfaSecretEncrypted: null }).where(eq(users.id, ctx.user.id));
    await db.insert(securityEvents).values({ userId: ctx.user.id, eventType: "mfa_disabled" });
    return { enabled: false } as const;
  }),

  myEvents: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
    return db.select({ id: securityEvents.id, eventType: securityEvents.eventType, ipAddress: securityEvents.ipAddress, userAgent: securityEvents.userAgent, createdAt: securityEvents.createdAt }).from(securityEvents).where(and(eq(securityEvents.userId, ctx.user.id))).orderBy(desc(securityEvents.createdAt)).limit(input?.limit ?? 30);
  }),
});
