import { createHash } from "node:crypto";

const apiBase = process.env.QAYD_API_BASE ?? "http://127.0.0.1:3000";
const endpoint = `${process.env.ZATCA_SIMULATION_BASE_URL ?? "https://gw-fatoora.zatca.gov.sa"}${process.env.ZATCA_SIMULATION_COMPLIANCE_PATH ?? "/e-invoicing/simulation/compliance"}`;

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
  return { status: response.status, body, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? null };
}

function trpcData(body) {
  return body?.[0]?.result?.data?.json ?? body?.[0]?.result?.data ?? null;
}

function hasError(body) {
  return Boolean(body?.[0]?.error);
}

function safeErrorCode(body) {
  return body?.[0]?.error?.json?.data?.code ?? body?.[0]?.error?.data?.code ?? "UNKNOWN";
}

async function main() {
  const otp = (await new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { value += chunk; });
    process.stdin.once("end", () => resolve(value));
    process.stdin.once("error", reject);
  })).trim();
  if (!/^\d{6}$/.test(otp)) throw new Error("OTP_INPUT_INVALID");
  const identifier = process.env.LOCAL_ADMIN_EMAIL;
  const password = process.env.LOCAL_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("LOCAL_AUTH_UNAVAILABLE");
  const login = await trpcMutation("auth.localLogin", { identifier, password, acceptTerms: true, acceptPrivacy: true });
  if (login.status !== 200 || hasError(login.body) || !login.cookie) throw new Error(`LOCAL_LOGIN_FAILED:${safeErrorCode(login.body)}`);
  const csr = await trpcMutation("zatca.generateCsr", { tenantId: 1, companyId: 1, egsId: 4 }, login.cookie);
  if (csr.status !== 200 || hasError(csr.body)) throw new Error(`CSR_GENERATION_FAILED:${safeErrorCode(csr.body)}`);
  const csrPem = trpcData(csr.body)?.csrPem;
  if (typeof csrPem !== "string") throw new Error("CSR_RESPONSE_INVALID");
  console.log(`Environment: simulation\nEndpoint: ${endpoint}\nCSR SHA256: ${createHash("sha256").update(csrPem, "utf8").digest("hex")}\nCSR Length: ${Buffer.byteLength(csrPem, "utf8")}\nHTTP Method: POST\nContent-Type: application/json\nAccept-Version: ${process.env.ZATCA_API_VERSION ?? "V2"}\nOTP Present: YES\nOTP Validity: ACTIVE`);
  const onboarding = await trpcMutation("zatca.startComplianceOnboarding", { tenantId: 1, companyId: 1, egsId: 4, otp, csrPem }, login.cookie);
  if (onboarding.status !== 200 || hasError(onboarding.body)) {
    console.log(`ONBOARDING_RESULT=FAILED\nTRPC_HTTP_STATUS=${onboarding.status}\nTRPC_ERROR_CODE=${safeErrorCode(onboarding.body)}`);
    process.exitCode = 2;
    return;
  }
  const result = trpcData(onboarding.body);
  console.log(`ONBOARDING_RESULT=SUCCESS\nREQUEST_ID=${result?.requestId ?? "absent"}\nCSID_STORAGE=REQUESTED`);
}

main().catch((error) => {
  console.error(`ONBOARDING_FATAL=${error instanceof Error ? error.message : "unknown"}`);
  process.exitCode = 2;
});
