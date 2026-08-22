import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: {
    data: {
      egs: [{ id: 9, deviceName: "QAYD EGS Simulation", serialNumber: "QAYD-EGS-SIM-001", connectionStatus: "pending", complianceCsidStatus: "pending", csrStatus: "issued" }],
    },
    refetch: vi.fn(),
  },
  mutation: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    zatca: {
      settings: { useQuery: () => mocks.settings },
      generateCsr: { useMutation: mocks.mutation },
      createEgs: { useMutation: mocks.mutation },
      startComplianceOnboarding: { useMutation: mocks.mutation },
    },
  },
}));

import { ZatcaSettingsPanel } from "../../client/src/components/ZatcaSettingsPanel";

describe("ZATCA settings OTP panel", () => {
  it("يعرض حقل OTP مقنّعاً وإرشادات الاستخدام الآمن", () => {
    const html = renderToStaticMarkup(<ZatcaSettingsPanel tenantId={1} companyId={1} />);
    expect(html).toContain("رمز OTP للمحاكاة");
    expect(html).toContain('type="password"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain("يُستخدم مرة واحدة ويُمسح تلقائيًا بعد النتيجة");
    expect(html).toContain("بدء ربط ZATCA");
    expect(html).not.toContain("684868");
  });
});
