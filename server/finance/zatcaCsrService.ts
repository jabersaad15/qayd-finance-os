import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function escapeConfig(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, " ").replace(/[\r\[\]]/g, "").trim();
}

function simulationRegisteredAddress(city: string) {
  const normalized = city.trim();
  const supportedArabicCities: Record<string, string> = {
    "الرياض": "Riyadh",
    "جدة": "Jeddah",
    "مكة": "Makkah",
    "المدينة المنورة": "Madinah",
    "الدمام": "Dammam",
  };
  const address = supportedArabicCities[normalized] ?? normalized;
  if (!/^[\x20-\x7E]+$/.test(address)) throw new Error("Use an English registered address for the Simulation CSR when the company city is not in the supported city mapping.");
  return escapeConfig(address);
}

export function selectCsrLegalName(legalNameEn: string | null | undefined, legalNameAr: string) {
  return legalNameEn?.trim() || legalNameAr;
}

export async function generateSimulationCsr(input: { legalName: string; vatNumber: string; serialNumber: string; email?: string | null; nationalAddress?: string | null; city?: string | null; countryCode?: string | null; invoiceType?: "standard" | "simplified" | "both" }) {
  if (!/^3\d{14}$/.test(input.vatNumber)) throw new Error("Company VAT number must contain 15 digits and start with 3.");
  if (!/^(?=.*[A-Z])[A-Z0-9][A-Z0-9._-]{2,127}$/.test(input.serialNumber)) throw new Error("EGS serial number must include at least one English letter and cannot be a numeric OTP.");
  const directory = await mkdtemp(join(tmpdir(), "qayd-zatca-csr-"));
  const keyPath = join(directory, "private-key.pem");
  const csrPath = join(directory, "request.csr");
  const configPath = join(directory, "openssl.cnf");
  const country = escapeConfig(input.countryCode ?? "SA");
  const city = escapeConfig(input.city ?? "Riyadh");
  const legalName = escapeConfig(input.legalName);
  const serial = escapeConfig(input.serialNumber);
  const email = escapeConfig(input.email ?? "");
  const registeredAddress = simulationRegisteredAddress(input.city ?? "Riyadh");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Company email must be valid before generating the Simulation CSR.");
  const invoiceType = input.invoiceType ?? "both";
  const invoiceTitle = invoiceType === "simplified" ? "0100" : invoiceType === "standard" ? "1000" : "1100";
  const config = `oid_section = OIDs\n[OIDs]\ncertificateTemplateName = 1.3.6.1.4.1.311.20.2\n[req]\nprompt = no\nutf8 = yes\nstring_mask = utf8only\ndefault_md = sha256\ndistinguished_name = dn\nreq_extensions = req_ext\n[dn]\nC = ${country}\nOU = ${legalName}\nO = ${legalName}\nCN = PREZATCA-Code-Signing\nL = ${city}\nemailAddress = ${email}\n[v3_req]\nbasicConstraints = CA:FALSE\nkeyUsage = digitalSignature, nonRepudiation, keyEncipherment\n[req_ext]\ncertificateTemplateName = ASN1:PRINTABLESTRING:PREZATCA-Code-Signing\nsubjectAltName = dirName:subject\n[subject]\nSN = 1-QAYD|2-SIMULATION|3-${serial}\nUID = ${input.vatNumber}\ntitle = ${invoiceTitle}\nregisteredAddress = ${registeredAddress}\nbusinessCategory = Financial Services\n`;
  try {
    await writeFile(configPath, config, { mode: 0o600 });
    await execFileAsync("openssl", ["req", "-new", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:secp256k1", "-nodes", "-keyout", keyPath, "-out", csrPath, "-config", configPath], { timeout: 30_000, maxBuffer: 1024 * 1024 });
    const [privateKeyPem, csrPem] = await Promise.all([readFile(keyPath, "utf8"), readFile(csrPath, "utf8")]);
    if (!privateKeyPem.includes("BEGIN EC PRIVATE KEY") && !privateKeyPem.includes("BEGIN PRIVATE KEY")) throw new Error("Generated private key failed validation.");
    if (!csrPem.includes("BEGIN CERTIFICATE REQUEST") || !csrPem.includes("END CERTIFICATE REQUEST")) throw new Error("Generated CSR failed validation.");
    return { privateKeyPem, csrPem };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
