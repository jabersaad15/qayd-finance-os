import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));

import { sendPasswordResetEmail } from "./passwordReset";

describe("password reset email dispatch", () => {
  beforeEach(() => {
    mocks.sendMail.mockReset();
    mocks.close.mockReset();
    mocks.createTransport.mockReset();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail, close: mocks.close });
    mocks.sendMail.mockResolvedValue({ messageId: "mock-reset-message" });
    process.env.SMTP_HOST = "smtp.test.local";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "noreply@test.local";
    process.env.SMTP_PASSWORD = "test-password";
    process.env.SMTP_FROM = "QAYD <noreply@test.local>";
  });

  it("dispatches a reset email containing only the secure reset link", async () => {
    const token = "a".repeat(64);
    const result = await sendPasswordResetEmail({
      to: "user@example.com",
      recipient: "مستخدم تجريبي",
      token,
      publicAppUrl: "https://qayd.tech",
    });

    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.test.local", port: 465, secure: true }));
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "user@example.com",
      subject: expect.stringContaining("QAYD"),
      text: expect.stringContaining(`/reset-password?token=${token}`),
    }));
    expect(result.messageId).toBe("mock-reset-message");
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
