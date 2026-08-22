export const defaultChartOfAccounts = [
  { code: "1100", nameAr: "النقدية والبنوك", accountType: "asset", normalBalance: "debit" },
  { code: "1200", nameAr: "الذمم المدينة التجارية", accountType: "asset", normalBalance: "debit" },
  { code: "1300", nameAr: "ضريبة القيمة المضافة القابلة للاسترداد", accountType: "asset", normalBalance: "debit" },
  { code: "2100", nameAr: "الذمم الدائنة التجارية", accountType: "liability", normalBalance: "credit" },
  { code: "2200", nameAr: "ضريبة القيمة المضافة المستحقة", accountType: "liability", normalBalance: "credit" },
  { code: "3100", nameAr: "رأس المال والأرباح المبقاة", accountType: "equity", normalBalance: "credit" },
  { code: "4100", nameAr: "إيرادات الخدمات", accountType: "revenue", normalBalance: "credit" },
  { code: "5100", nameAr: "تكلفة الإيرادات", accountType: "cost_of_revenue", normalBalance: "debit" },
  { code: "6100", nameAr: "مصروفات تشغيلية", accountType: "expense", normalBalance: "debit" },
] as const;

export function createFiscalPeriodName(startDate: string, endDate: string) {
  return `${startDate.slice(0, 4)}-${endDate.slice(0, 4)}`;
}

