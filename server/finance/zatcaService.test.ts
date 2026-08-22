import { describe, expect, it, vi } from "vitest";
import { decryptZatcaSecret, encryptZatcaSecret, redactZatcaError } from "./zatcaCrypto";
import { buildComplianceDiagnostic, requestSimulationComplianceCsid, validateCsrPem } from "./zatcaService";
import { generateSimulationCsr } from "./zatcaCsrService";

describe("ZATCA secret handling", () => {
  it("encrypts and decrypts without storing plaintext", () => {
    const plaintext = "binary-token-secret-value";
    const encrypted = encryptZatcaSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptZatcaSecret(encrypted)).toBe(plaintext);
  });

  it("redacts credential-like values from errors", () => {
    const safe = redactZatcaError(new Error("OTP=123456 secret=abc privateKey=hidden"));
    expect(safe).not.toContain("123456");
    expect(safe).not.toContain("abc");
    expect(safe).not.toContain("hidden");
  });
});

describe("ZATCA simulation service", () => {
  const csr = "-----BEGIN CERTIFICATE REQUEST-----\n" + "A".repeat(140) + "\n-----END CERTIFICATE REQUEST-----";

  it("validates PEM CSR boundaries", () => {
    expect(validateCsrPem(csr)).toContain("BEGIN CERTIFICATE REQUEST");
    expect(() => validateCsrPem("not-a-csr")).toThrow(/CSR/);
  });

  it("ينشئ سجلاً تشخيصياً كاملاً البنية دون كشف OTP أو secret أو token", () => {
    const diagnostic = buildComplianceDiagnostic({
      endpoint: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance",
      csrPem: csr,
      apiVersion: "V2",
      responseStatus: 400,
      responseHeaders: new Headers({ "x-request-id": "request-42", "content-type": "application/json", "set-cookie": "must-not-appear" }),
      rawResponse: JSON.stringify({ errors: [{ code: "Invalid-OTP", message: "OTP=123456 secret=hidden binarySecurityToken=token-value" }] }),
      succeeded: false,
    });
    const serialized = JSON.stringify(diagnostic);
    expect(diagnostic.request.otpPresent).toBe(true);
    expect(diagnostic.response.requestId).toBe("request-42");
    expect(serialized).toContain("Invalid-OTP");
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain("hidden");
    expect(serialized).not.toContain("token-value");
    expect(serialized).not.toContain("set-cookie");
  });

  it("يلخّص حقول نجاح ZATCA دون تخزين CSID أو Secret نصاً", () => {
    const diagnostic = buildComplianceDiagnostic({
      endpoint: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance",
      csrPem: csr,
      apiVersion: "V2",
      responseStatus: 200,
      responseHeaders: new Headers({ "x-request-id": "request-200", "content-type": "application/json" }),
      rawResponse: JSON.stringify({ requestID: "request-200", binarySecurityToken: "token-do-not-store", secret: "secret-do-not-store", dispositionMessage: "ISSUED" }),
      succeeded: true,
    });
    const serialized = JSON.stringify(diagnostic);
    expect(serialized).toContain('"requestIdPresent":true');
    expect(serialized).toContain('"binarySecurityTokenPresent":true');
    expect(serialized).toContain('"secretPresent":true');
    expect(serialized).not.toContain("token-do-not-store");
    expect(serialized).not.toContain("secret-do-not-store");
  });

  it("generates a simulation CSR and private key server-side", async () => {
    const result = await generateSimulationCsr({ legalName: "QAYD Test Company", vatNumber: "312345678901237", serialNumber: "QAYD-EGS-SIM-001", email: "test@qayd.tech", nationalAddress: "Riyadh National Address", city: "Riyadh", countryCode: "SA" });
    expect(result.csrPem).toContain("BEGIN CERTIFICATE REQUEST");
    expect(result.privateKeyPem).toMatch(/BEGIN (EC )?PRIVATE KEY/);
  });

  it("exposes a safe reason for a non-JSON HTTP 400 without leaking OTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<Error><message>Invalid OTP=123456 secret=hidden</message></Error>", { status: 400, headers: { "content-type": "application/xml" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestSimulationComplianceCsid({ otp: "123456", csrPem: csr, companyVatNumber: "312345678901237" })).rejects.toThrow("ZATCA_INVALID_OTP");
    vi.unstubAllGlobals();
  });

  it("extracts a nested ZATCA rejection reason safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ validationResults: { errorMessages: [{ code: "invalid-csr", message: "CSR does not match VAT registration" }] } }), { status: 400, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestSimulationComplianceCsid({ otp: "121541", csrPem: csr, companyVatNumber: "312345678901237" })).rejects.toThrow("ZATCA_INVALID_CSR");
    vi.unstubAllGlobals();
  });

  it("يعطي توجيهاً آمناً عند رفض HTTP 400 بلا سبب قابل للاستخراج", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestSimulationComplianceCsid({ otp: "121541", csrPem: csr, companyVatNumber: "312345678901237" })).rejects.toThrow("ZATCA_ENVIRONMENT_OR_REGISTRATION_MISMATCH");
    vi.unstubAllGlobals();
  });

  it("sends OTP only to the backend request and returns status-only data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ requestID: "req-1", binarySecurityToken: "token-1", secret: "secret-1", dispositionMessage: "ISSUED", status: "ISSUED" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestSimulationComplianceCsid({ otp: "123456", csrPem: csr, companyVatNumber: "312345678901237" });
    expect(result.requestId).toBe("req-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Record<string, string>).OTP).toBe("123456");
    expect(JSON.stringify(result)).toContain("token-1");
    vi.unstubAllGlobals();
  });
});
