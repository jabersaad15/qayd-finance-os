import { describe, expect, it } from "vitest";
import { deriveAccountantDashboardState, filterAccountantDashboardSnapshot, validateAccountantDateRange } from "../../shared/accountantDashboardState";

describe("accountant dashboard state", () => {
  it("يعرض حالة فارغة صريحة عند غياب البيانات التشغيلية", () => {
    expect(deriveAccountantDashboardState({})).toMatchObject({ hasOperationalData: false, pendingSupplier: 0, reviewedVat: 0, balanced: true });
  });

  it("يشتق المهام ومؤشر توازن الميزان من البيانات الفعلية", () => {
    const state = deriveAccountantDashboardState({
      purchases: [{ invoice: { status: "pending_review" } }, { invoice: { status: "draft" } }],
      compliance: { submissions: [{}], checks: [{}], reviewCount: 2, queuedCount: 1 },
      vat: { periods: [{}], preparations: [{ status: "under_review" }, { status: "reviewed" }], zakatDocuments: [] },
      balance: [{ debit: "100.00", credit: "90.00" }],
    });
    expect(state).toMatchObject({ hasOperationalData: true, pendingSupplier: 1, draftSupplier: 1, preparedVat: 1, reviewedVat: 1, reviewCount: 2, queuedCompliance: 1, balanced: false, debit: 100, credit: 90 });
  });

  it("يطبق الفترة على السجلات ذات التاريخ ويعيد حساب مؤشرات الامتثال", () => {
    const filtered = filterAccountantDashboardSnapshot({
      purchases: [{ invoice: { status: "pending_review", invoiceDate: "2026-01-10" } }, { invoice: { status: "draft", invoiceDate: "2026-04-10" } }],
      compliance: { submissions: [{ status: "queued", createdAt: "2026-01-15" }, { status: "queued", createdAt: "2026-04-15" }], checks: [{ hasCriticalErrors: true, checkedAt: "2026-01-20" }, { hasCriticalErrors: true, checkedAt: "2026-04-20" }] },
      vat: { periods: [{ period: { startDate: "2026-01-01", endDate: "2026-03-31" } }, { period: { startDate: "2026-04-01", endDate: "2026-06-30" } }], preparations: [], zakatDocuments: [] }, balance: [],
    }, { startDate: "2026-01-01", endDate: "2026-03-31" });
    expect(filtered.purchases).toHaveLength(1);
    expect(filtered.compliance?.queuedCount).toBe(1);
    expect(filtered.compliance?.reviewCount).toBe(1);
    expect(filtered.vat?.periods).toHaveLength(1);
  });

  it("يرفض الفترة المعكوسة ويقبل الفترة الصحيحة", () => {
    expect(validateAccountantDateRange({ startDate: "2026-04-01", endDate: "2026-03-01" })).toContain("يسبق");
    expect(validateAccountantDateRange({ startDate: "2026-01-01", endDate: "2026-03-31" })).toBeNull();
  });
});
