export function formatZatcaOnboardingError(message: string) {
  if (message.includes("ZATCA_INVALID_OTP")) return "رمز OTP غير صالح أو منتهٍ. أنشئ رمزاً جديداً من بوابة FATOORA في بيئة Simulation ثم أعد المحاولة.";
  if (message.includes("ZATCA_INVALID_CSR")) return "رفضت ZATCA طلب CSR. أعد توليد CSR من الخادم وتحقق من بيانات التسجيل الضريبي للشركة قبل إدخال OTP جديد.";
  if (message.includes("ZATCA_ENVIRONMENT_OR_REGISTRATION_MISMATCH")) return "لم تطابق ZATCA الطلب مع البيئة أو بيانات التسجيل. تحقق من أن OTP صادر من Simulation وأن الرقم الضريبي وبيانات الشركة مطابقة للبوابة.";
  return "تعذر إتمام ربط ZATCA حالياً. أعد توليد CSR وتحقق من بيئة Simulation قبل استخدام OTP جديد.";
}
