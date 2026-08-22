import { describe, expect, it } from "vitest";
import { buildSalesSupervisorInvoiceCsv } from "../../shared/salesSupervisorInvoiceCsv";

describe("sales supervisor invoice board", () => {
  it("يبني تصديراً منظماً لفواتير الفريق ويحتوي التاريخ الفارغ بأمان", () => {
    const csv = buildSalesSupervisorInvoiceCsv([{ invoiceNumber: "INV-2026-001", status: "draft", issueDate: "2026-08-17", dueDate: null, grandTotal: "1725.000000" }]);
    expect(csv).toContain("invoiceNumber,status,issueDate,dueDate,grandTotal");
    expect(csv).toContain('"INV-2026-001","draft","2026-08-17","—","1725.000000"');
  });
});

