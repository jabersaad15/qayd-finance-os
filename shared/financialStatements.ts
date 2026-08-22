export type FinancialStatementAccount = {
  accountType: string;
  debit: string;
  credit: string;
};

export function accountStatementBalance(row: FinancialStatementAccount): number {
  const debit = Number(row.debit);
  const credit = Number(row.credit);
  return ["asset", "expense", "cost_of_revenue", "other_expense"].includes(row.accountType) ? debit - credit : credit - debit;
}

export function sumStatementBalances(rows: FinancialStatementAccount[]): number {
  return rows.reduce((total, row) => total + accountStatementBalance(row), 0);
}
