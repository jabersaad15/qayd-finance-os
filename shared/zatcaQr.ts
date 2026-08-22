export type ZatcaQrInvoiceFields = {
  sellerName: string;
  vatNumber: string;
  timestamp: Date | string;
  invoiceTotal: string | number;
  vatTotal: string | number;
};

const MAX_TLV_VALUE_LENGTH = 255;

function normaliseAmount(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function normaliseTimestamp(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("لا يمكن إنشاء QR ضريبي بتاريخ فاتورة غير صالح.");
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function encodeTlvField(tag: number, value: string) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > MAX_TLV_VALUE_LENGTH) throw new Error("قيمة حقل QR الضريبي أطول من الحد المسموح.");
  return Uint8Array.from([tag, bytes.length, ...bytes]);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

/**
 * Encodes the mandatory base ZATCA invoice QR fields as TLV/Base64:
 * seller name, VAT registration number, issue timestamp, total with VAT, and VAT total.
 */
export function createZatcaTlvBase64(fields: ZatcaQrInvoiceFields) {
  const sellerName = fields.sellerName.trim();
  const vatNumber = fields.vatNumber.trim();
  if (!sellerName || !vatNumber) throw new Error("يلزم اسم البائع والرقم الضريبي لإنشاء QR الفاتورة.");

  const values = [
    encodeTlvField(1, sellerName),
    encodeTlvField(2, vatNumber),
    encodeTlvField(3, normaliseTimestamp(fields.timestamp)),
    encodeTlvField(4, normaliseAmount(fields.invoiceTotal)),
    encodeTlvField(5, normaliseAmount(fields.vatTotal)),
  ];
  const length = values.reduce((total, item) => total + item.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  values.forEach((item) => { result.set(item, offset); offset += item.length; });
  return toBase64(result);
}
