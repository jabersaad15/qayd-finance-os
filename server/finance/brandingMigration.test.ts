import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRODUCT_BRAND } from "../../shared/productBrand";

const publicBrandingFiles = [
  "client/index.html",
  "client/public/manifest.json",
  "client/src/pages/LocalLogin.tsx",
  "client/src/components/DashboardLayout.tsx",
  "client/src/pages/CustomerPortalPage.tsx",
  "client/src/components/OfficialDocumentTemplate.tsx",
  "client/src/components/BrandingSettings.tsx",
  "server/finance/employeeInvitationEmail.ts",
  "server/finance/customerPaymentReminderEmail.ts",
  "server/finance/internalNotifications.ts",
  "server/finance/teamOwnerAlerts.ts",
  "server/routers/scheduling.ts",
  "server/scheduled/financeReminders.ts",
];

const readProjectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("QAYD branding migration", () => {
  it("defines the approved Arabic and English product identity", () => {
    expect(PRODUCT_BRAND.bilingual).toBe("قيد | QAYD");
    expect(PRODUCT_BRAND.arabicTagline).toBe("نظام التشغيل المالي الذكي للشركات");
    expect(PRODUCT_BRAND.arabicSlogan).toBe("كل قيد يقود إلى قرار.");
    expect(PRODUCT_BRAND.englishSlogan).toBe("Every Entry Leads to a Decision.");
    const html = readProjectFile("client/index.html");
    expect(html).toContain('property="og:site_name" content="قيد | QAYD"');
    expect(readProjectFile("client/public/manifest.json")).toContain('"short_name": "قيد"');
  });

  it("does not expose legacy product names in public branding files", () => {
    const legacyNames = ["CONSEDRA Finance OS", "QYDRA OS", "QYDRA"];
    for (const file of publicBrandingFiles) {
      const source = readProjectFile(file);
      for (const legacyName of legacyNames) expect(source).not.toContain(legacyName);
    }
  });

  it("keeps the owner relationship explicit without making it the product name", () => {
    expect(PRODUCT_BRAND.ownerCredit).toBe("QAYD by CONSEDRA");
    expect(PRODUCT_BRAND.bilingual).not.toContain("CONSEDRA");
  });
});
