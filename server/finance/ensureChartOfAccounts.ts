import { and, eq } from "drizzle-orm";
import { accounts } from "../../drizzle/schema";
import { defaultChartOfAccounts } from "./setup";

export async function ensureDefaultChartOfAccounts(db: any, tenantId: number, companyId: number) {
  const existingRows = await db.select({ code: accounts.code }).from(accounts).where(and(eq(accounts.tenantId, tenantId), eq(accounts.companyId, companyId)));
  const existingCodes = new Set(existingRows.map((account: { code: string }) => account.code));
  const missing = defaultChartOfAccounts.filter((account) => !existingCodes.has(account.code));
  if (missing.length > 0) {
    await db.insert(accounts).values(missing.map((account) => ({ ...account, tenantId, companyId, isPosting: true, isActive: true })));
  }
  return missing.map((account) => account.code);
}
