export function documentSaveErrorMessage(message: string, kind: "quotation" | "invoice") {
  const type = kind === "quotation" ? "عرض السعر" : "الفاتورة";
  const normalized = message.toLowerCase();
  if (normalized.includes("duplicate") || normalized.includes("unique")) return `تعذر حفظ ${type} لأن رقم المستند محجوز بالفعل. أعد المحاولة ليُحجز رقم جديد تلقائياً.`;
  if (normalized.includes("quotations") || normalized.includes("invoices") || normalized.includes("scopeofwork") || normalized.includes("paymentterms")) return `تعذر حفظ ${type} مؤقتاً بسبب توافق إعدادات المستند. تم تسجيل الحالة للمراجعة؛ أعد المحاولة بعد تحديث الصفحة.`;
  return `تعذر حفظ ${type}. تحقق من العميل والبنود والتواريخ ثم أعد المحاولة.`;
}
