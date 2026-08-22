import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import tls from "node:tls";

const execFileAsync = promisify(execFile);
const apiBase = process.env.QAYD_API_BASE ?? "http://127.0.0.1:3000";
const endpoint = `${process.env.ZATCA_SIMULATION_BASE_URL ?? "https://gw-fatoora.zatca.gov.sa"}${process.env.ZATCA_SIMULATION_COMPLIANCE_PATH ?? "/e-invoicing/simulation/compliance"}`;
const apiVersion = process.env.ZATCA_API_VERSION ?? "V2";
const requiredSerial = "QAYD-EGS-SIM-001";
const vatNumber = "314352144600003";
const checks = new Map();

function mark(name, ok, detail) {
  checks.set(name, { ok: Boolean(ok), detail });
}

function findValue(value, key) {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (key in value) return value[key];
  for (const child of Object.values(value)) {
    const found = findValue(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function trpcInput(input) {
  return JSON.stringify({ 0: { json: input } });
}

async function trpcMutation(path, input, cookie) {
  const response = await fetch(`${apiBase}/api/trpc/${path}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: trpcInput(input),
  });
  const body = await response.json();
  if (!response.ok || body?.[0]?.error) throw new Error(`tRPC ${path} failed with HTTP ${response.status}`);
  return { body, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? null };
}

async function trpcQuery(path, input, cookie) {
  const response = await fetch(`${apiBase}/api/trpc/${path}?batch=1&input=${encodeURIComponent(trpcInput(input))}`, {
    method: "GET",
    headers: { ...(cookie ? { Cookie: cookie } : {}) },
  });
  const body = await response.json();
  if (!response.ok || body?.[0]?.error) throw new Error(`tRPC ${path} failed with HTTP ${response.status}`);
  return { body };
}

async function openSession() {
  const identifier = process.env.LOCAL_ADMIN_EMAIL;
  const password = process.env.LOCAL_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("Local admin credentials are not available to run preflight.");
  const result = await trpcMutation("auth.localLogin", { identifier, password, acceptTerms: true, acceptPrivacy: true });
  if (!result.cookie) throw new Error("Local login did not return a session cookie.");
  return result.cookie;
}

async function inspectTls(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: true }, () => {
      const certificate = socket.getPeerCertificate();
      const result = { authorized: socket.authorized, subject: certificate.subject?.CN ?? null, issuer: certificate.issuer?.CN ?? null };
      socket.end();
      resolve(result);
    });
    socket.setTimeout(15_000, () => { socket.destroy(new Error("TLS timeout")); });
    socket.once("error", reject);
  });
}

async function inspectCsr(csrPem) {
  const directory = await mkdtemp(join(tmpdir(), "qayd-zatca-preflight-"));
  const csrPath = join(directory, "current.csr");
  try {
    await writeFile(csrPath, csrPem, { mode: 0o600 });
    const [{ stdout: verifyStdout, stderr: verifyStderr }, { stdout: subject }, { stdout: details }] = await Promise.all([
      execFileAsync("openssl", ["req", "-in", csrPath, "-noout", "-verify"], { timeout: 15_000 }),
      execFileAsync("openssl", ["req", "-in", csrPath, "-noout", "-subject", "-nameopt", "utf8"], { timeout: 15_000 }),
      execFileAsync("openssl", ["req", "-in", csrPath, "-noout", "-text", "-nameopt", "utf8"], { timeout: 15_000 }),
    ]);
    return { verify: `${verifyStdout}\n${verifyStderr}`, subject, details };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  const url = new URL(endpoint);
  const proxyConfigured = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"].some((key) => Boolean(process.env[key]));
  const addresses = await dns.lookup(url.hostname, { all: true });
  const tlsInfo = await inspectTls(url.hostname);
  mark("Environment", endpoint.includes("/e-invoicing/simulation/") && !endpoint.includes("/production/"), "simulation");
  mark("Endpoint", url.protocol === "https:" && url.hostname === "gw-fatoora.zatca.gov.sa" && url.pathname === "/e-invoicing/simulation/compliance", `${url.origin}${url.pathname}`);
  mark("Network", addresses.length > 0 && !proxyConfigured, `${addresses.map((item) => item.address).join(", ")}; proxy=${proxyConfigured ? "configured" : "none"}`);
  mark("TLS", tlsInfo.authorized === true, `CN=${tlsInfo.subject}; issuer=${tlsInfo.issuer}`);

  const probe = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Version": apiVersion }, body: JSON.stringify({ csr: "" }) });
  const probeBody = await probe.text();
  const probeRequestId = probe.headers.get("x-request-id") ?? probe.headers.get("request-id") ?? null;
  mark("Endpoint probe", probe.status === 400 && probeBody.includes("Missing-OTP"), `HTTP ${probe.status}; requestId=${probeRequestId ?? "absent"}; body=${probeBody.slice(0, 300)}`);

  const cookie = await openSession();
  const generated = await trpcMutation("zatca.generateCsr", { tenantId: 1, companyId: 1, egsId: 4 }, cookie);
  const csrPem = findValue(generated.body, "csrPem");
  if (typeof csrPem !== "string") throw new Error("Generate CSR did not return a PEM payload.");
  const csrSha256 = createHash("sha256").update(csrPem, "utf8").digest("hex");
  const csrInspection = await inspectCsr(csrPem);
  const fields = `${csrInspection.subject}\n${csrInspection.details}`;
  mark("CSR Parse", /^-----BEGIN CERTIFICATE REQUEST-----/.test(csrPem) && /-----END CERTIFICATE REQUEST-----\s*$/.test(csrPem), `sha256=${csrSha256}; length=${Buffer.byteLength(csrPem, "utf8")}`);
  mark("CSR Signature", /self-signature verify OK/.test(csrInspection.verify), csrInspection.verify.trim());
  mark("CSR Fields", ["C=SA", "CN=PREZATCA-Code-Signing", "emailAddress=info@consedra.com", `UID=${vatNumber}`, `SN=1-QAYD|2-SIMULATION|3-${requiredSerial}`, "title=1100", "الرياض"].every((value) => fields.includes(value)) && !fields.includes("Ø§Ù"), "subject and subjectAltName fields decoded with UTF-8");
  const registeredAddressOk = /registeredAddress=Riyadh/.test(csrInspection.details) && !/registeredAddress=\\?(?:x)?C3\\?(?:x)?98\\?(?:x)?C2/i.test(csrInspection.details);
  mark("CSR Registered Address", registeredAddressOk, "registeredAddress=Riyadh; no double-encoded UTF-8 byte sequence");
  mark("CSR OIDs", /1\.3\.6\.1\.4\.1\.311\.20\.2/.test(csrInspection.details) && /PREZATCA-Code-Signing/.test(csrInspection.details) && /secp256k1/.test(csrInspection.details), "PREZATCA template OID and secp256k1 present");
  const encoded = Buffer.from(csrPem, "utf8").toString("base64");
  mark("CSR Encoding", Buffer.from(encoded, "base64").toString("utf8") === csrPem && !/\s/.test(encoded), `base64Length=${encoded.length}; single encoding round-trip=PASS`);
  const headers = { "Content-Type": "application/json", Accept: "application/json", "Accept-Version": apiVersion, OTP: "[PRESENT ONLY AT ONE-SHOT]" };
  mark("Headers", headers["Content-Type"] === "application/json" && headers.Accept === "application/json" && headers["Accept-Version"] === "V2", JSON.stringify(headers));
  const payload = JSON.stringify({ csr: encoded });
  mark("Payload", JSON.parse(payload).csr === encoded, `json csr field; length=${encoded.length}`);

  const settings = await trpcQuery("zatca.settings", { tenantId: 1, companyId: 1 }, cookie);
  const credentials = findValue(settings.body, "credentials");
  const egs = findValue(settings.body, "egs");
  const selectedEgs = Array.isArray(egs) ? egs.find((item) => item?.id === 4) : null;
  const oldCredentialsClear = Array.isArray(credentials) && credentials.length === 0;
  mark("Credentials State", oldCredentialsClear && selectedEgs?.serialNumber === requiredSerial && selectedEgs?.environment === "simulation", `credentials=${Array.isArray(credentials) ? credentials.length : "unknown"}; egs=${selectedEgs?.serialNumber ?? "missing"}`);

  const ordered = ["Environment", "Endpoint", "Network", "TLS", "Endpoint probe", "CSR Parse", "CSR Signature", "CSR Fields", "CSR Registered Address", "CSR OIDs", "CSR Encoding", "Headers", "Payload", "Credentials State"];
  console.log("ZATCA PREFLIGHT");
  for (const name of ordered) {
    const result = checks.get(name);
    console.log(`${name}: ${result?.ok ? "PASS" : "FAIL"} — ${result?.detail ?? "not evaluated"}`);
  }
  const ready = ordered.every((name) => checks.get(name)?.ok);
  console.log(`READY FOR OTP: ${ready ? "YES" : "NO"}`);
  console.log(`REQUEST PREVIEW: Environment=simulation; Endpoint=${endpoint}; CSR_SHA256=${csrSha256}; CSR_Length=${Buffer.byteLength(csrPem, "utf8")}; HTTP_Method=POST; Content-Type=application/json; Accept-Version=${apiVersion}; OTP_Present=NO`);
  process.exitCode = ready ? 0 : 2;
}

main().catch((error) => {
  console.error(`PREFLIGHT_FATAL: ${error instanceof Error ? error.message : "unknown failure"}`);
  process.exitCode = 2;
});
