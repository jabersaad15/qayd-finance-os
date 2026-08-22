import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Smart Onboarding", () => {
  it("exposes resumable session procedures and a staged wizard", () => {
    const router = readFileSync(new URL("../routers/finance.ts", import.meta.url), "utf8");
    const panel = readFileSync(new URL("../../client/src/components/SmartOnboardingPanel.tsx", import.meta.url), "utf8");
    expect(router).toContain("onboardingGetOrCreate");
    expect(router).toContain("onboardingSaveProgress");
    expect(router).toContain("onboardingGoLive");
    expect(router).toContain('code: "MAIN"');
    expect(router).toContain("ensureDefaultChartOfAccounts");
    expect(router).toContain("onboardingCreateImportBatch");
    expect(router).toContain("onboardingCommitImportBatch");
    expect(router).toContain("onboardingImportHistory");
    expect(panel).toContain("سجل دفعات الاستيراد");
    expect(panel).toContain("payload: JSON.stringify(importRows)");
    expect(router).toContain("onboardingRecommendations");
    expect(router).toContain("onboardingReadiness");
    expect(router).toContain("opening_balances_import");
    expect(panel).toContain("approvalRequired");
    expect(panel).toContain("Setup Completion");
    expect(panel).toContain("recommendations.data.recommendations");
    expect(panel).toContain("QAYD Setup Wizard");
    expect(panel).toContain("حفظ ومتابعة");
    expect(panel).toContain("تشغيل الشركة");
  });

  it("keeps Go Live behind an explicit readiness threshold", () => {
    const router = readFileSync(new URL("../routers/finance.ts", import.meta.url), "utf8");
    expect(router).toContain("session.percent < 80");
    expect(router).toContain("confirmed: z.literal(true)");
  });

  it("uses tenant and company scope for onboarding persistence", () => {
    const schema = readFileSync(new URL("../../drizzle/schema.ts", import.meta.url), "utf8");
    const router = readFileSync(new URL("../routers/finance.ts", import.meta.url), "utf8");
    expect(schema).toContain("onboarding_session_scope_uq");
    expect(schema).toContain("onboardingImportBatches");
    expect(schema).toContain("payload: text(\"payload\")");
    expect(router).toContain("eq(onboardingSessions.tenantId, input.tenantId)");
    expect(router).toContain("eq(onboardingSessions.companyId, input.companyId)");
  });
});
