import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { generateSimulationCsr, selectCsrLegalName } from "./zatcaCsrService";

const execFileAsync = promisify(execFile);

describe("ZATCA simulation CSR", () => {
  it("generates a CSR with the Simulation template and required subjectAltName fields", async () => {
    const result = await generateSimulationCsr({
      legalName: "شركة كونسيدرا القابضة",
      vatNumber: "314352144600003",
      serialNumber: "QAYD-EGS-SIM-001",
      email: "info@consedra.com",
      nationalAddress: "Riyadh National Address",
      city: "Riyadh",
      invoiceType: "both",
    });
    expect(result.csrPem).toContain("BEGIN CERTIFICATE REQUEST");
    const directory = await mkdtemp(join(tmpdir(), "qayd-csr-test-"));
    const csrPath = join(directory, "request.csr");
    try {
      await writeFile(csrPath, result.csrPem, "utf8");
      const { stdout } = await execFileAsync("openssl", ["req", "-in", csrPath, "-text", "-noout"], { timeout: 10_000 });
      expect(stdout).toContain("PREZATCA-Code-Signing");
      expect(stdout).toMatch(/1\.3\.6\.1\.4\.1\.311\.20\.2|Certificate Template Name/);
      expect(stdout).not.toContain("1.3.6.1.4.1.311.21.7");
      expect(stdout).toContain("CN = PREZATCA-Code-Signing");
      expect(stdout).toContain("emailAddress = info@consedra.com");
      expect(stdout).not.toContain("Basic Constraints");
      expect(stdout).not.toContain("Key Usage");
      expect(stdout).toContain("UID=314352144600003");
      expect(stdout).toContain("SN=1-QAYD|2-SIMULATION|3-QAYD-EGS-SIM-001");
      expect(stdout).toContain("title=1100");
      expect(stdout).toContain("registeredAddress=Riyadh");
      expect(result.privateKeyPem).toContain("PRIVATE KEY");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("يفضّل الاسم القانوني الإنجليزي ويعود للعربي عند غيابه", () => {
    expect(selectCsrLegalName("Consedra Holding", "شركة كونسيدرا القابضة")).toBe("Consedra Holding");
    expect(selectCsrLegalName("  ", "شركة كونسيدرا القابضة")).toBe("شركة كونسيدرا القابضة");
    expect(selectCsrLegalName(null, "شركة كونسيدرا القابضة")).toBe("شركة كونسيدرا القابضة");
  });

  it("يحفظ المدينة والعنوان العربيين بترميز UTF-8 واحد داخل CSR", async () => {
    const result = await generateSimulationCsr({
      legalName: "Consedra Company Holding",
      vatNumber: "314352144600003",
      serialNumber: "QAYD-EGS-SIM-001",
      email: "info@consedra.com",
      city: "الرياض",
      invoiceType: "both",
    });
    const directory = await mkdtemp(join(tmpdir(), "qayd-csr-utf8-test-"));
    const csrPath = join(directory, "request.csr");
    try {
      await writeFile(csrPath, result.csrPem, "utf8");
      const [{ stdout: subject }, { stdout: details }] = await Promise.all([
        execFileAsync("openssl", ["req", "-in", csrPath, "-noout", "-subject", "-nameopt", "utf8"], { timeout: 10_000 }),
        execFileAsync("openssl", ["req", "-in", csrPath, "-text", "-noout", "-nameopt", "utf8"], { timeout: 10_000 }),
      ]);
      expect(subject).toContain("L=الرياض");
      expect(`${subject}\n${details}`).not.toContain("Ø§Ù");
      expect(details).not.toMatch(/registeredAddress=\\?(?:x)?C3\\?(?:x)?98\\?(?:x)?C2/i);
      expect(details).toContain("registeredAddress=Riyadh");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
