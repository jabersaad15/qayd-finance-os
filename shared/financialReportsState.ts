export type FinancialReportRow = {
  id: number;
  code: string;
  nameAr: string;
  accountType: string;
  debit: string;
  credit: string;
};

const incomeTypes = new Set(["revenue", "other_income", "cost_of_revenue", "expense", "other_expense"]);
const positionTypes = new Set(["asset", "liability", "equity"]);

const total = (rows: FinancialReportRow[]) => rows.reduce((sum, row) => sum + Number(row.debit) - Number(row.credit), 0);

export function deriveFinancialReportsState(rows: FinancialReportRow[] | null | undefined) {
  const allRows = rows ?? [];
  const incomeRows = allRows.filter((row) => incomeTypes.has(row.accountType));
  const positionRows = allRows.filter((row) => positionTypes.has(row.accountType));
  const revenues = incomeRows.filter((row) => ["revenue", "other_income"].includes(row.accountType));
  const expenses = incomeRows.filter((row) => ["cost_of_revenue", "expense", "other_expense"].includes(row.accountType));
  const assets = positionRows.filter((row) => row.accountType === "asset");
  const liabilities = positionRows.filter((row) => row.accountType === "liability");
  const equity = positionRows.filter((row) => row.accountType === "equity");
  const revenueTotal = total(revenues);
  const expenseTotal = total(expenses);
  const assetsTotal = total(assets);
  const liabilitiesTotal = total(liabilities);
  const equityTotal = total(equity);
  return { hasData: allRows.length > 0, revenues, expenses, assets, liabilities, equity, revenueTotal, expenseTotal, assetsTotal, liabilitiesTotal, equityTotal, netIncome: revenueTotal - expenseTotal, liabilitiesAndEquityTotal: liabilitiesTotal + equityTotal };
}
