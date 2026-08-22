import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ENV } from "../_core/env";
import { redactZatcaError } from "./zatcaCrypto";

export type ZatcaEnvironment = "simulation" | "production";

export type ComplianceCsidResult = {
  requestId: string | null;
  binarySecurityToken: string | null;
  secret: string | null;
  dispositionMessage: string | null;
  status: string | null;
};

function assertSimulationEnvironment(environment: ZatcaEnvironment) {
  if (environment !== "simulation") throw new Error("Production onboarding is disabled until the production workflow is explicitly enabled.");
}

function readString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function safeResponseReason(raw: string) {
  const compact = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return null;
  const redacted = compact.replace(/(otp|secret|token|authorization|password|private.?key)\s*[:=]\s*[^,;\s]+/gi, "$1=[REDACTED]");
  return redacted.slice(0, 300);
}

function redactDiagnosticText(value: string) {
  return value
    .replace(/(["']?(?:otp|secret|token|authorization|password|private.?key|binarySecurityToken)["']?\s*[:=]\s*["']?)[^,;\s"'}]+/gi, "$1[REDACTED]")
    .replace(/(-----BEGIN (?:EC )?PRIVATE KEY-----)[\s\S]*?(-----END (?:EC )?PRIVATE KEY-----)/g, "$1[REDACTED]$2");
}

function selectedResponseHeaders(headers: Headers) {
  const allowed = new Set(["content-type", "date", "server", "x-request-id", "request-id", "correlation-id", "cf-ray", "via"]);
  return Object.fromEntries([...headers.entries()].filter(([name]) => allowed.has(name.toLowerCase())));
}

function successfulResponseSummary(raw: string) {
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const token = readString(payload, ["binarySecurityToken", "binary_security_token"]);
    const secret = readString(payload, ["secret"]);
    const requestId = readString(payload, ["requestID", "requestId", "request_id"]);
    return {
      responseKeys: Object.keys(payload).sort(),
      requestIdPresent: Boolean(requestId),
      binarySecurityTokenPresent: Boolean(token),
      binarySecurityTokenLength: token?.length ?? 0,
      secretPresent: Boolean(secret),
      secretLength: secret?.length ?? 0,
    };
  } catch {
    return { responseKeys: [], requestIdPresent: false, binarySecurityTokenPresent: false, binarySecurityTokenLength: 0, secretPresent: false, secretLength: 0 };
  }
}

export function buildComplianceDiagnostic(input: { endpoint: string; csrPem: string; apiVersion: string; responseStatus: number; responseHeaders: Headers; rawResponse: string; succeeded: boolean }) {
  const responseHeaders = selectedResponseHeaders(input.responseHeaders);
  return {
    timestamp: new Date().toISOString(),
    environment: "simulation",
    request: {
      method: "POST",
      endpoint: input.endpoint,
      contentType: "application/json",
      accept: "application/json",
      acceptVersion: input.apiVersion,
      otpPresent: true,
      csrSha256: createHash("sha256").update(input.csrPem, "utf8").digest("hex"),
      csrLength: Buffer.byteLength(input.csrPem, "utf8"),
      bodyStructure: { csr: "base64(utf8-pem)" },
    },
    response: {
      httpStatus: input.responseStatus,
      headers: responseHeaders,
      requestId: responseHeaders["x-request-id"] ?? responseHeaders["request-id"] ?? null,
      correlationId: responseHeaders["correlation-id"] ?? null,
      body: input.succeeded ? "[OMITTED: successful response may contain credentials]" : redactDiagnosticText(input.rawResponse),
      ...(input.succeeded ? { successSummary: successfulResponseSummary(input.rawResponse) } : {}),
    },
  };
}

async function persistComplianceDiagnostic(diagnostic: ReturnType<typeof buildComplianceDiagnostic>) {
  try {
    const directory = join(ENV.localStoragePath, "zatca-diagnostics");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const name = `compliance-${diagnostic.timestamp.replace(/[:.]/g, "-")}-${diagnostic.response.httpStatus}.json`;
    await writeFile(join(directory, name), `${JSON.stringify(diagnostic, null, 2)}\n`, { mode: 0o600 });
  } catch (error) {
    console.warn("[ZATCA] Unable to persist a sanitized compliance diagnostic", { reason: error instanceof Error ? error.message : "unknown" });
  }
}

function nestedResponseReason(value: unknown, depth = 0): string | null {
  if (depth > 4 || value === null || value === undefined) return null;
  if (typeof value === "string") return safeResponseReason(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = nestedResponseReason(item, depth + 1);
      if (reason) return reason;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  for (const [key, item] of Object.entries(value)) {
    if (/message|error|detail|disposition|reason|description/i.test(key)) {
      const reason = nestedResponseReason(item, depth + 1);
      if (reason) return reason;
    }
  }
  for (const item of Object.values(value)) {
    const reason = nestedResponseReason(item, depth + 1);
    if (reason) return reason;
  }
  return null;
}

function complianceRejectionMessage(status: number, payload: Record<string, unknown>, raw: string) {
  const message = readString(payload, ["dispositionMessage", "message", "error"]) ?? nestedResponseReason(payload) ?? safeResponseReason(raw);
  if (message && /invalid[-_ ]?otp|otp.*(invalid|expired)/i.test(message)) return "ZATCA_INVALID_OTP: رمز OTP غير صالح أو منتهٍ. أنشئ رمزاً جديداً من بيئة Simulation فقط.";
  if (message && /invalid[-_ ]?csr|csr.*(invalid|match|registration)/i.test(message)) return "ZATCA_INVALID_CSR: بيانات CSR لا تطابق متطلبات ZATCA أو بيانات تسجيل المنشأة.";
  if (message) return `ZATCA_REQUEST_REJECTED: ${message}`;
  if (status === 400) return "ZATCA_ENVIRONMENT_OR_REGISTRATION_MISMATCH: رفضت ZATCA الطلب دون سبب تفصيلي. تحقّق من أن OTP صادر من Simulation وأن الرقم الضريبي وبيانات التسجيل في CSR تطابق البيئة المختارة.";
  return `ZATCA returned HTTP ${status}.`;
}

export function validateCsrPem(csrPem: string) {
  const normalized = csrPem.trim();
  if (!normalized.includes("-----BEGIN CERTIFICATE REQUEST-----") || !normalized.includes("-----END CERTIFICATE REQUEST-----")) {
    throw new Error("CSR must be a PEM-encoded certificate request.");
  }
  if (normalized.length > 20000) throw new Error("CSR exceeds the maximum supported size.");
  return normalized;
}

export async function requestSimulationComplianceCsid(input: { otp: string; csrPem: string; companyVatNumber: string }) {
  assertSimulationEnvironment("simulation");
  const otp = input.otp.trim();
  if (otp.length < 4 || otp.length > 64) throw new Error("OTP is invalid or expired. Generate a new OTP from FATOORA Simulation Portal.");
  const csrPem = validateCsrPem(input.csrPem);
  const vatNumber = input.companyVatNumber.trim();
  if (!/^3\d{14}$/.test(vatNumber)) throw new Error("Company VAT number must contain 15 digits and start with 3.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${ENV.zatcaSimulationBaseUrl}${ENV.zatcaSimulationCompliancePath}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Version": ENV.zatcaApiVersion,
        OTP: otp,
      },
      body: JSON.stringify({ csr: Buffer.from(csrPem, "utf8").toString("base64") }),
    });
    const raw = await response.text();
    const diagnostic = buildComplianceDiagnostic({
      endpoint: `${ENV.zatcaSimulationBaseUrl}${ENV.zatcaSimulationCompliancePath}`,
      csrPem,
      apiVersion: ENV.zatcaApiVersion,
      responseStatus: response.status,
      responseHeaders: response.headers,
      rawResponse: raw,
      succeeded: response.ok,
    });
    await persistComplianceDiagnostic(diagnostic);
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
    } catch {
      // Keep response body out of logs and error messages; only expose the HTTP status.
    }
    if (!response.ok) {
      const message = complianceRejectionMessage(response.status, payload, raw);
      console.warn("[ZATCA] Compliance CSID rejected", {
        status: response.status,
        reason: message,
        requestId: diagnostic.response.requestId,
        correlationId: diagnostic.response.correlationId,
        csrSha256: diagnostic.request.csrSha256,
        csrLength: diagnostic.request.csrLength,
      });
      throw new Error(message);
    }
    return {
      requestId: readString(payload, ["requestID", "requestId", "request_id"]),
      binarySecurityToken: readString(payload, ["binarySecurityToken", "binary_security_token"]),
      secret: readString(payload, ["secret"]),
      dispositionMessage: readString(payload, ["dispositionMessage", "message"]),
      status: readString(payload, ["status", "disposition"]),
    } satisfies ComplianceCsidResult;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("ZATCA request timed out. Try again after checking the Simulation connection.");
    throw new Error(redactZatcaError(error));
  } finally {
    clearTimeout(timeout);
  }
}
