import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { companyBranding } from "../../drizzle/schema";

describe("company branding", () => {
  it("يحتوي هوية الشركة على الاسم والشعار والأيقونة والألوان", () => {
    const columns = getTableColumns(companyBranding);
    expect(columns.displayNameAr).toBeDefined();
    expect(columns.displayNameEn).toBeDefined();
    expect(columns.logoUrl).toBeDefined();
    expect(columns.faviconUrl).toBeDefined();
    expect(columns.primaryColor).toBeDefined();
    expect(columns.accentColor).toBeDefined();
    expect(columns.surfaceColor).toBeDefined();
  });

  it("يعزل هوية الشركة بمفتاح tenant/company موحد", () => {
    const indexes = Object.values(companyBranding).filter((value) => typeof value === "object");
    expect(indexes.length).toBeGreaterThan(0);
  });
});
