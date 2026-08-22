import { describe, expect, it } from "vitest";
import { buildAccountantExportRows } from "../../client/src/lib/accountantReportExport";

describe("accountant report export payload", () => {
  it("يبني صفوفاً عربية من المؤشرات المالية الفعلية", () => {
    const rows = buildAccountantExportRows({ pendingSupplier: 2, draftSupplier: 1, preparedVat: 3, reviewedVat: 4, reviewCount: 5, queuedCompliance: 6, debit: 1200, credit: 1200, balanced: true, hasOperationalData: true }, new Date("2026-08-15T00:00:00Z"), { startDate: "2026-01-01", endDate: "2026-03-31" });
    expect(rows).toContainEqual(["الفترة المحددة", "2026-01-01 — 2026-03-31"]);
    expect(rows).toContainEqual(["مراجعة الموردين", 2]);
    expect(rows).toContainEqual(["إجمالي المدين", 1200]);
    expect(rows).toContainEqual(["إجمالي الدائن", 1200]);
    expect(rows).toContainEqual(["حالة ميزان المراجعة", "متوازن"]);
  });
});
