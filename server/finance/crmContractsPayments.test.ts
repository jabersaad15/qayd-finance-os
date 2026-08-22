import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { customerContracts, customerPaymentReminderEvents, financialReminderSchedules } from "../../drizzle/schema";
import { buildCustomerPaymentSummary } from "../routers/sales";

describe("CRM contracts and customer payment follow-up", () => {
  it("يوفر سجلاً منظماً للعقد وسجل منع تكرار تذكيرات الاستحقاق", () => {
    const contractColumns = getTableColumns(customerContracts);
    const reminderColumns = getTableColumns(customerPaymentReminderEvents);
    const scheduleColumns = getTableColumns(financialReminderSchedules);
    expect(contractColumns.customerId).toBeDefined();
    expect(contractColumns.contractNumber).toBeDefined();
    expect(contractColumns.contractValue).toBeDefined();
    expect(contractColumns.documentId).toBeDefined();
    expect(reminderColumns.invoiceId).toBeDefined();
    expect(reminderColumns.reminderDate).toBeDefined();
    expect(scheduleColumns.reminderType.enumValues).toContain("customer_payment_due");
  });

  it("يحسب الإجمالي والمدفوع والمتبقي ويصنف الفاتورة المتأخرة والقريبة", () => {
    const result = buildCustomerPaymentSummary([
      { id: 1, invoiceNumber: "INV-2026-001", status: "approved", issueDate: new Date("2026-08-01"), dueDate: new Date("2026-08-10"), grandTotal: "100.000000", paidTotal: "30.000000" },
      { id: 2, invoiceNumber: "INV-2026-002", status: "partially_paid", issueDate: new Date("2026-08-10"), dueDate: new Date("2026-08-20"), grandTotal: "80.000000", paidTotal: "0.000000" },
      { id: 3, invoiceNumber: "INV-2026-003", status: "paid", issueDate: new Date("2026-08-01"), dueDate: new Date("2026-08-05"), grandTotal: "20.000000", paidTotal: "20.000000" },
    ], new Date("2026-08-15T12:00:00.000Z"));
    expect(result.totalInvoiced).toBe("200.000000");
    expect(result.totalPaid).toBe("50.000000");
    expect(result.remainingBalance).toBe("150.000000");
    expect(result.overdue.map((item) => item.invoiceNumber)).toEqual(["INV-2026-001"]);
    expect(result.upcoming.map((item) => item.invoiceNumber)).toEqual(["INV-2026-002"]);
    expect(result.invoices.find((item) => item.invoiceNumber === "INV-2026-001")?.settlementStatus).toBe("partially_paid");
    expect(result.invoices.find((item) => item.invoiceNumber === "INV-2026-003")?.settlementStatus).toBe("paid");
  });
});
