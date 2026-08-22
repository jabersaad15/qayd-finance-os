export const salesQuotationRoles = ["super_admin", "cfo", "finance_manager", "accountant", "sales", "sales_rep"] as const;
export const invoiceIssueRoles = ["super_admin", "cfo", "finance_manager"] as const;
export const salesSupervisorRoles = ["super_admin", "cfo", "finance_manager", "sales"] as const;
export const salesRepRoles = ["sales_rep"] as const;
export const salesCrmRoles = ["super_admin", "cfo", "finance_manager", "sales", "sales_rep"] as const;
export const salesReadRoles = ["super_admin", "cfo", "finance_manager", "sales", "sales_rep", "ceo_assistant", "executive_assistant"] as const;
export const salesCommissionAdminRoles = ["super_admin", "cfo", "finance_manager"] as const;
export const financeAccountingManagerRoles = ["cfo", "finance_manager"] as const;
export const financeAdministrationRoles = ["super_admin", "cfo", "finance_manager"] as const;

export function isFinanceAccountingManager(roleCode: string | null | undefined) {
  return Boolean(roleCode && financeAccountingManagerRoles.includes(roleCode as typeof financeAccountingManagerRoles[number]));
}

export function canUseCompanyCapability(roleCode: string | null | undefined, allowedRoles: readonly string[]) {
  return Boolean(roleCode && allowedRoles.includes(roleCode));
}

/** The platform owner retains company-wide authority while active membership still scopes tenant/company access. */
export function canAdministerFinance(companyRoleCode: string | null | undefined, platformRole: "admin" | "user" | null | undefined) {
  return platformRole === "admin" || canUseCompanyCapability(companyRoleCode, financeAdministrationRoles);
}
