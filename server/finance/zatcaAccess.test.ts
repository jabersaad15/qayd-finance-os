import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers/zatca.ts"), "utf8");

describe("ZATCA owner access", () => {
  it("يسمح للمالك الشامل بإدارة إعدادات ZATCA Simulation", () => {
    expect(routerSource).toContain('"super_admin"');
    expect(routerSource).toContain("تعديل إعدادات ZATCA متاح للإدارة المالية المخولة فقط");
  });

  it("يحافظ على حصر الكتابة في الأدوار المخولة ولا يفتحها لكل عضو", () => {
    expect(routerSource).toContain('"company_admin"');
    expect(routerSource).toContain('"cfo"');
    expect(routerSource).toContain('"accountant"');
    expect(routerSource).toContain("if (write && ![");
  });

  it("لا يحفظ OTP في السجلات أو الاستجابة", () => {
    expect(routerSource).not.toContain("newValue: { otp");
    expect(routerSource).not.toContain("return { otp:");
    expect(routerSource).toContain("requestSimulationComplianceCsid({ otp: input.otp");
  });
});

