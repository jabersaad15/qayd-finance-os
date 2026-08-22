import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production SMTP runtime configuration", () => {
  it("passes all SMTP variables from runtime secrets into the app container", () => {
    const compose = readFileSync(resolve(process.cwd(), "deployment/hostinger/docker-compose.vps.yml"), "utf8");
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"]) {
      expect(compose).toContain(`${key}: \${${key}}`);
    }
  });
});
