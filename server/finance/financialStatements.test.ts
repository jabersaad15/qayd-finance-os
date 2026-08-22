import { describe, expect, it } from "vitest";
import { accountStatementBalance, sumStatementBalances } from "../../shared/financialStatements";

describe("financial statement balances", () => {
  it("يحسب رصيد الأصول والمصروفات من المدين ويحسب الإيرادات والالتزامات من الدائن", () => {
    expect(accountStatementBalance({ accountType: "asset", debit: "150.000000", credit: "20.000000" })).toBe(130);
    expect(accountStatementBalance({ accountType: "expense", debit: "80.000000", credit: "5.000000" })).toBe(75);
    expect(accountStatementBalance({ accountType: "revenue", debit: "15.000000", credit: "250.000000" })).toBe(235);
    expect(accountStatementBalance({ accountType: "liability", debit: "10.000000", credit: "90.000000" })).toBe(80);
  });

  it("يجمع أرصدة الحسابات المصدرية للقائمة من دون الاعتماد على أرقام واجهة ثابتة", () => {
    expect(sumStatementBalances([{ accountType: "revenue", debit: "0", credit: "300" }, { accountType: "revenue", debit: "20", credit: "0" }])).toBe(280);
  });
});
