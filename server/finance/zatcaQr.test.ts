import { describe, expect, it } from "vitest";
import { createZatcaTlvBase64 } from "../../shared/zatcaQr";

function readTlv(payload: string) {
  const bytes = Buffer.from(payload, "base64");
  const decoder = new TextDecoder();
  const fields: Array<{ tag: number; value: string }> = [];
  for (let offset = 0; offset < bytes.length;) {
    const tag = bytes[offset++];
    const length = bytes[offset++];
    fields.push({ tag, value: decoder.decode(bytes.subarray(offset, offset + length)) });
    offset += length;
  }
  return fields;
}

describe("ZATCA TLV invoice QR payload", () => {
  it("يرمز الحقول الأساسية بالترتيب الرسمي وبأرقام إنجليزية ثابتة", () => {
    const payload = createZatcaTlvBase64({
      sellerName: "شركة كونسيدرا القابضة",
      vatNumber: "314352144600003",
      timestamp: "2026-08-16T08:30:00.000Z",
      invoiceTotal: "1150",
      vatTotal: 150,
    });

    expect(readTlv(payload)).toEqual([
      { tag: 1, value: "شركة كونسيدرا القابضة" },
      { tag: 2, value: "314352144600003" },
      { tag: 3, value: "2026-08-16T08:30:00Z" },
      { tag: 4, value: "1150.00" },
      { tag: 5, value: "150.00" },
    ]);
  });

  it("يرفض بيانات البائع غير المكتملة بدلاً من إنشاء رمز ضريبي خاطئ", () => {
    expect(() => createZatcaTlvBase64({ sellerName: "", vatNumber: "314352144600003", timestamp: "2026-08-16", invoiceTotal: 0, vatTotal: 0 })).toThrow("يلزم اسم البائع");
  });
});
