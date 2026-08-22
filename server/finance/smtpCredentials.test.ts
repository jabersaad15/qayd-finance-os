import nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";

describe("SMTP reminder configuration", () => {
  it("has the required Hostinger SMTP configuration", () => {
    expect(process.env.SMTP_HOST).toBeTruthy();
    expect(Number(process.env.SMTP_PORT || 465)).toBeGreaterThan(0);
    expect(process.env.SMTP_USER).toBeTruthy();
    expect(process.env.SMTP_PASSWORD).toBeTruthy();
  });

  it.runIf(process.env.RUN_SMTP_INTEGRATION_TESTS === "1")("authenticates against the configured SMTP endpoint", async () => {
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, family: 4, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000 });
    await expect(transporter.verify()).resolves.toBe(true);
    transporter.close();
  }, 15000);
});
