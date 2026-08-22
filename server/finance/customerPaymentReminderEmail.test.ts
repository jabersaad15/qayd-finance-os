import { describe, expect, it } from "vitest";
import { buildPaymentReminderEmail, buildWhatsAppReminderUrl } from "./customerPaymentReminderEmail";

describe("customer payment reminder messages", () => {
  const input = { customerName: "شركة اختبار", invoiceNumber: "INV-2026-004", outstanding: "1250.000000", dueDate: "2026-08-10", companyName: "CONSEDRA" };

  it("يبني رسالة بريد عربية تتضمن رقم الفاتورة والرصيد وتاريخ الاستحقاق", () => {
    const message = buildPaymentReminderEmail({ ...input, to: "customer@example.com" });
    expect(message.subject).toContain("INV-2026-004");
    expect(message.text).toContain("1250.00 SAR");
    expect(message.text).toContain("2026-08-10");
    expect(message.html).toContain("شركة اختبار");
  });

  it("ينشئ رابط واتساب برسالة مهيأة للعميل", () => {
    const url = buildWhatsAppReminderUrl({ ...input, phone: "+966 50 123 4567" });
    expect(url).toMatch(/^https:\/\/wa\.me\/966501234567\?text=/);
    expect(decodeURIComponent(url)).toContain("INV-2026-004");
  });
});
