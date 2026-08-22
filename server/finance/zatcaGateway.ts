import { ENV } from "../_core/env";
import { redactZatcaError } from "./zatcaCrypto";

export type ZatcaGatewayResult = { requestId: string | null; status: string | null; warnings: string[]; errors: string[]; responseReference: string | null };

type Credential = { token: string; secret: string };

function textValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function listValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").slice(0, 20);
  }
  return [];
}

async function post(path: string, input: { body: Record<string, unknown>; credential: Credential; otp?: string }) {
  if (!path.startsWith("/e-invoicing/simulation/")) throw new Error("Simulation credentials cannot be used with a non-simulation endpoint.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const auth = Buffer.from(`${input.credential.token}:${input.credential.secret}`, "utf8").toString("base64");
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json", "Accept-Version": ENV.zatcaApiVersion, Authorization: `Basic ${auth}` };
    if (input.otp) headers.OTP = input.otp;
    const response = await fetch(`${ENV.zatcaSimulationBaseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(input.body), signal: controller.signal });
    const raw = await response.text();
    let payload: Record<string, unknown> = {};
    try { const parsed = JSON.parse(raw) as unknown; if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>; } catch { /* only status is retained */ }
    const result: ZatcaGatewayResult = { requestId: textValue(payload, ["requestID", "requestId", "request_id"]), status: textValue(payload, ["status", "disposition", "reportingStatus", "clearanceStatus"]), warnings: listValue(payload, ["warnings", "warningMessages"]), errors: listValue(payload, ["errors", "errorMessages"]), responseReference: textValue(payload, ["invoiceHash", "responseReference", "referenceNumber"]) };
    if (!response.ok) { const reason = textValue(payload, ["dispositionMessage", "message", "error"]) ?? `ZATCA returned HTTP ${response.status}.`; throw new Error(reason); }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("ZATCA request timed out. Try again after checking the Simulation connection.");
    throw new Error(redactZatcaError(error));
  } finally { clearTimeout(timeout); }
}

export async function requestSimulationProductionCsid(input: { requestId: string; credential: Credential }) {
  return post(ENV.zatcaSimulationProductionCsidPath, { credential: input.credential, body: { complianceRequestId: input.requestId } });
}

export async function runSimulationComplianceCheck(input: { invoiceHash: string; uuid: string; invoiceXmlBase64: string; credential: Credential }) {
  if (!/^[a-f0-9]{64}$/i.test(input.invoiceHash)) throw new Error("Invoice hash must be a SHA-256 hexadecimal value.");
  if (!/^[0-9a-f-]{16,64}$/i.test(input.uuid)) throw new Error("Invoice UUID format is invalid.");
  return post(ENV.zatcaSimulationComplianceChecksPath, { credential: input.credential, body: { invoiceHash: input.invoiceHash, uuid: input.uuid, invoice: input.invoiceXmlBase64 } });
}

export async function submitSimulationInvoice(input: { flow: "clearance" | "reporting"; invoiceHash: string; uuid: string; invoiceXmlBase64: string; credential: Credential }) {
  const path = input.flow === "clearance" ? ENV.zatcaSimulationClearancePath : ENV.zatcaSimulationReportingPath;
  return post(path, { credential: input.credential, body: { invoiceHash: input.invoiceHash, uuid: input.uuid, invoice: input.invoiceXmlBase64 } });
}
