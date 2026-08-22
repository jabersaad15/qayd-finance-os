import { describe, expect, it } from "vitest";
import { deriveFinancialReportsState } from "../../shared/financialReportsState";

const row = (id: number, accountType: string, debit: string, credit: string) => ({ id, code: `A-${id}`, nameAr: `حساب ${id}`, accountType, debit, credit });

describe("financial reports state", () => {
  it("يحافظ على حالة الفراغ بدلاً من اختلاق أرصدة", () => {
    expect(deriveFinancialReportsState([])).toMatchObject({ hasData: false, netIncome: 0, liabilitiesAndEquityTotal: 0 });
  });

  it("يصنف الحسابات ويحسب النتائج من أرصدة التقرير الفعلية", () => {
    const state = deriveFinancialReportsState([row(1, "revenue", "0", "1000"), row(2, "expense", "400", "0"), row(3, "asset", "1400", "0"), row(4, "liability", "0", "500"), row(5, "equity", "0", "900")]);
    expect(state).toMatchObject({ hasData: true, revenueTotal: -1000, expenseTotal: 400, netIncome: -1400, assetsTotal: 1400, liabilitiesAndEquityTotal: -1400 });
    expect(state.revenues).toHaveLength(1);
    expect(state.expenses).toHaveLength(1);
  });
});
