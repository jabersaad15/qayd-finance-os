import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { and, eq, gt, isNull } from "drizzle-orm";
import { passwordResetTokens, users } from "../../drizzle/schema";
import { getDb, getUserByEmail, getUserByUsername } from "../db";
import { PRODUCT_BRAND } from "../../shared/productBrand";
import { recordSecurityEvent } from "../_core/localAuth";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashPasswordResetToken(token) };
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appBaseUrl(publicAppUrl?: string) {
  return (publicAppUrl || PRODUCT_BRAND.defaultLoginUrl).replace(/\/login\/?$/, "").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

export function buildPasswordResetEmail(input: { recipient?: string | null; token: string; publicAppUrl?: string }) {
  const recipient = input.recipient || "الزميل/الزميلة";
  const resetUrl = `${appBaseUrl(input.publicAppUrl)}/reset-password?token=${encodeURIComponent(input.token)}`;
  const subject = `استعادة كلمة المرور — ${PRODUCT_BRAND.bilingual}`;
  const safeRecipient = escapeHtml(recipient);
  const text = `مرحباً ${recipient}،\n\nتلقينا طلباً لاستعادة كلمة المرور في ${PRODUCT_BRAND.bilingual}. استخدم الرابط التالي خلال 30 دقيقة:\n${resetUrl}\n\nإذا لم تطلب ذلك، تجاهل الرسالة. لن تطلب المنصة كلمة المرور أو رمز الاستعادة عبر البريد.\n\nمع التحية،\n${PRODUCT_BRAND.bilingual}`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#24352f"><h2 style="color:#0b3d3a">استعادة كلمة المرور</h2><p>مرحباً <strong>${safeRecipient}</strong>،</p><p>تلقينا طلباً لاستعادة كلمة المرور في ${PRODUCT_BRAND.bilingual}. الرابط صالح لمدة <strong>30 دقيقة</strong> ويُستخدم مرة واحدة فقط.</p><p><a href="${resetUrl}" style="display:inline-block;background:#0b3d3a;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px">تعيين كلمة مرور جديدة</a></p><p style="color:#8a594f"><strong>تنبيه أمني:</strong> إذا لم تطلب الاستعادة، تجاهل الرسالة. لن تطلب المنصة كلمة المرور أو رمز الاستعادة عبر البريد.</p><p>مع التحية،<br/>${PRODUCT_BRAND.bilingual}</p></div>`;
  return { subject, text, html, resetUrl };
}

export async function sendPasswordResetEmail(input: { to: string; recipient?: string | null; token: string; publicAppUrl?: string }) {
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const message = buildPasswordResetEmail(input);
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: input.to, subject: message.subject, text: message.text, html: message.html });
  transporter.close();
  return { messageId: info.messageId, subject: message.subject, resetUrl: message.resetUrl };
}

export async function issuePasswordReset(input: { identifier: string; requestIp?: string; publicAppUrl?: string }) {
  const identifier = input.identifier.trim().toLowerCase();
  const user = (await getUserByEmail(identifier)) ?? (await getUserByUsername(identifier));
  if (!user?.email) return { accepted: true, emailSent: false } as const;

  const db = await getDb();
  if (!db) throw new Error("database_unavailable");
  const { token, tokenHash } = createPasswordResetToken();
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS), requestIp: input.requestIp || null });
  await recordSecurityEvent({ userId: user.id, eventType: "password_reset_requested", ipAddress: input.requestIp });
  await sendPasswordResetEmail({ to: user.email, recipient: user.name, token, publicAppUrl: input.publicAppUrl });
  return { accepted: true, emailSent: true } as const;
}

export async function consumePasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("database_unavailable");
  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  const [row] = await db.select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId }).from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now))).limit(1);
  if (!row) return null;
  const updated = await db.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)));
  if (!updated) return null;
  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  return user || null;
}
