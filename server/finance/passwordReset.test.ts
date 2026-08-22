import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail, createPasswordResetToken, hashPasswordResetToken, PASSWORD_RESET_TTL_MS } from "./passwordReset";

describe("password reset security", () => {
  it("creates a high-entropy token and stores only its hash", () => {
    const first = createPasswordResetToken();
    const second = createPasswordResetToken();
    expect(first.token).toHaveLength(64);
    expect(first.tokenHash).toHaveLength(64);
    expect(first.token).not.toBe(first.tokenHash);
    expect(first.token).not.toBe(second.token);
    expect(hashPasswordResetToken(first.token)).toBe(first.tokenHash);
    expect(PASSWORD_RESET_TTL_MS).toBe(30 * 60 * 1000);
  });

  it("builds a QAYD reset email without exposing a password or raw token outside the link", () => {
    const message = buildPasswordResetEmail({ recipient: "مستخدم تجريبي", token: "a".repeat(64), publicAppUrl: "https://qayd.tech/login" });
    expect(message.subject).toContain("QAYD");
    expect(message.resetUrl).toContain("https://qayd.tech/reset-password?token=");
    expect(message.text).toContain("30 دقيقة");
    expect(message.text).not.toContain("كلمة المرور المؤقتة");
    expect(message.html).toContain("لن تطلب المنصة كلمة المرور");
  });
});
