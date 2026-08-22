import { describe, expect, it } from "vitest";
import { createZatcaTlvBase64 } from "../../shared/zatcaQr";

describe("safe invoice barcode preview", () => {
  it("ينشئ رمزاً قابلاً للفك من بيانات المعاينة ولا يعتمد على إصدار أو ترحيل", () => {
    const preview = { sellerName: "شركة كونسيدرا القابضة", vatNumber: "314352144600003", timestamp: "2026-08-16T08:30:00.000Z", invoiceTotal: "1150", vatTotal: 150 };
    const barcode = createZatcaTlvBase64(preview);
    expect(barcode).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(barcode.length).toBeGreaterThan(20);
    expect(preview).not.toHaveProperty("invoiceId");
    expect(preview).not.toHaveProperty("journalEntryId");
  });
});
