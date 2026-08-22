import { describe, expect, it } from "vitest";
import { buildCollectionsInvoiceRows, buildCollectionsSummaryRows } from "../../client/src/lib/collectionsExport";

describe("collections exports", () => {
  const overdue = [{ invoiceNumber: "INV-2026-010", customerName: "شركة كونسيدرا", salesOwnerName: null, grandTotal: "1725.000000", paidTotal: "500.000000", outstanding: "1225.000000", dueDate: new Date("2026-08-10"), paymentStatus: "overdue" }];

  it("يبني ملخصاً يطابق مؤشرات لوحة التحصيلات", () => {
    const rows = buildCollectionsSummaryRows({ totalInvoiced: "1725.000000", totalPaid: "500.000000", remainingBalance: "1225.000000", overdue, invoices: overdue }, new Date("2026-08-16T07:00:00Z"), { startDate: "2026-08-01", endDate: "2026-08-16" });
    expect(rows).toContainEqual(["إجمالي الفواتير المعروضة", "1725.00"]);
    expect(rows).toContainEqual(["الرصيد المتبقي", "1225.00"]);
    expect(rows).toContainEqual(["عدد الفواتير المتأخرة", 1]);
  });

  it("يبني صفوف الفواتير المتأخرة بالأرقام والتاريخ والحالة", () => {
    const [row] = buildCollectionsInvoiceRows(overdue);
    expect(row).toMatchObject({ "رقم الفاتورة": "INV-2026-010", "مسؤول المبيعات": "غير معين", "المتبقي (SAR)": "1225.00", "تاريخ الاستحقاق": "2026-08-10", "الحالة": "متأخرة" });
  });
});
