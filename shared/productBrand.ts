export const PRODUCT_BRAND = {
  arabic: "قيد",
  english: "QAYD",
  bilingual: "قيد | QAYD",
  arabicTagline: "نظام التشغيل المالي الذكي للشركات",
  englishTagline: "AI Financial Operating System for Businesses",
  arabicSlogan: "كل قيد يقود إلى قرار.",
  englishSlogan: "Every Entry Leads to a Decision.",
  ownerCredit: "QAYD by CONSEDRA",
  defaultLoginUrl: "https://qayd.tech/login",
} as const;

export const LEGAL_ENTITY = {
  nameAr: "شركة كونسيدرا القابضة",
  nameEn: "Consedra Company Holding",
  commercialRegistration: "7052330474",
  unifiedNumber: "7052330474",
  vatNumber: "314352144600003",
  address: "العنوان المختصر: ARMA3887، طريق المطار 3887، حي جامعة الإمام محمد بن سعود الإسلامية، الرقم الفرعي 6736، الرمز البريدي 13318، الرياض، المملكة العربية السعودية.",
  email: "info@consedra.com",
  privacyEmail: "info@consedra.com",
  phone: "0531336664",
} as const;

export const LEGAL_POLICY_VERSIONS = {
  terms: "2026-08-18",
  privacy: "2026-08-18",
} as const;

export const LEGAL_POLICY_PATHS = {
  terms: "/terms",
  privacy: "/privacy",
} as const;

export const LEGAL_POLICY_HISTORY = [
  { version: "2026-08-18", effectiveAt: "2026-08-18", labelAr: "الإصدار التشغيلي الأول" },
] as const;

export const PRODUCT_BRAND_LEGACY_NAMES = ["CONSEDRA Finance OS", "QYDRA OS", "QYDRA"] as const;

export function productNameForLocale(locale: "ar" | "en" = "ar") {
  return locale === "en" ? PRODUCT_BRAND.english : PRODUCT_BRAND.arabic;
}
