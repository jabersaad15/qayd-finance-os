import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  issuePasswordReset: vi.fn(),
  consumePasswordResetToken: vi.fn(),
}));

vi.mock("./finance/passwordReset", () => ({
  issuePasswordReset: mocks.issuePasswordReset,
  consumePasswordResetToken: mocks.consumePasswordResetToken,
}));

import { appRouter } from "./routers";

describe("password reset request logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not log a raw reset token when dispatch fails", async () => {
    const rawToken = "a".repeat(64);
    mocks.issuePasswordReset.mockRejectedValueOnce(new Error(`SMTP delivery failed for token=${rawToken}`));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const caller = appRouter.createCaller({ req: { ip: "127.0.0.1", headers: {} }, res: {} } as never);

    await expect(caller.auth.requestPasswordReset({ identifier: "user@example.com" })).resolves.toEqual({ accepted: true });

    expect(warn).toHaveBeenCalledWith("[Auth] Password reset request was not dispatched");
    expect(JSON.stringify(warn.mock.calls)).not.toContain(rawToken);
  });

  it("does not log a reset token or link when dispatch succeeds", async () => {
    const rawToken = "b".repeat(64);
    const resetUrl = `https://qayd.tech/reset-password?token=${rawToken}`;
    mocks.issuePasswordReset.mockResolvedValueOnce({ accepted: true, emailSent: true, resetUrl });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const caller = appRouter.createCaller({ req: { ip: "127.0.0.1", headers: {} }, res: {} } as never);

    await expect(caller.auth.requestPasswordReset({ identifier: "user@example.com" })).resolves.toEqual({ accepted: true });

    const output = JSON.stringify([...warn.mock.calls, ...info.mock.calls, ...log.mock.calls]);
    expect(output).not.toContain(rawToken);
    expect(output).not.toContain(resetUrl);
  });
});
