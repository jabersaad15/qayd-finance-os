import { describe, expect, it } from "vitest";
import { canAdministerFinance, canUseCompanyCapability, financeAdministrationRoles, financeAccountingManagerRoles, invoiceIssueRoles, salesQuotationRoles, salesReadRoles, isFinanceAccountingManager } from "./roleAccess";
import { rolePermissionCodes } from "./rbac";

describe("company role access", () => {
  it("يسمح للمحاسب بإعداد عرض سعر ولا يمنحه إصدار فاتورة نهائية", () => {
    expect(canUseCompanyCapability("accountant", salesQuotationRoles)).toBe(true);
    expect(canUseCompanyCapability("accountant", invoiceIssueRoles)).toBe(false);
  });

  it("يعامل cfo وfinance_manager كدور مالي موحد", () => {
    expect(isFinanceAccountingManager("cfo")).toBe(true);
    expect(isFinanceAccountingManager("finance_manager")).toBe(true);
    expect(financeAccountingManagerRoles).toEqual(["cfo", "finance_manager"]);
    expect(rolePermissionCodes.cfo).toEqual(expect.arrayContaining(rolePermissionCodes.finance_manager));
  });

  it("يمنح الدور المالي الموحد صلاحيات الإدارة المالية دون إدارة النظام", () => {
    expect(financeAdministrationRoles).toContain("finance_manager");
    expect(financeAdministrationRoles).toContain("cfo");
    expect(rolePermissionCodes.finance_manager).toContain("accounting.approve");
    expect(rolePermissionCodes.finance_manager).toContain("period.manage");
    expect(rolePermissionCodes.finance_manager).not.toContain("company.manage");
  });

  it("يسمح للدور المالي الموحد بالإصدار ويمنع مدير النظام من ذلك", () => {
    expect(canUseCompanyCapability("company_admin", invoiceIssueRoles)).toBe(false);
    expect(canUseCompanyCapability("cfo", invoiceIssueRoles)).toBe(true);
  });

  it("يمنح مالك المنصة admin صلاحية الإدارة المالية دون منحها لعضو user غير مخول", () => {
    expect(canAdministerFinance("company_admin", "admin")).toBe(true);
    expect(canAdministerFinance("company_admin", "user")).toBe(false);
    expect(canAdministerFinance("finance_manager", "user")).toBe(true);
  });

  it("يمنع مساعد الرئيس التنفيذي من صلاحيات الفوترة والمبيعات والتدقيق", () => {
    expect(canUseCompanyCapability("ceo_assistant", invoiceIssueRoles)).toBe(false);
    expect(canUseCompanyCapability("ceo_assistant", salesQuotationRoles)).toBe(false);
    expect(canUseCompanyCapability("ceo_assistant", salesReadRoles)).toBe(true);
    expect(rolePermissionCodes.ceo_assistant).not.toContain("journal.post");
    expect(rolePermissionCodes.ceo_assistant).not.toContain("company.manage");
    expect(rolePermissionCodes.ceo_assistant).not.toContain("invoice.create");
  });

  it("يفصل نطاق المبيعات عن إصدار الفاتورة المالية", () => {
    expect(canUseCompanyCapability("sales", invoiceIssueRoles)).toBe(false);
    expect(canUseCompanyCapability("sales_rep", invoiceIssueRoles)).toBe(false);
    expect(rolePermissionCodes.sales).not.toContain("invoice.create");
    expect(rolePermissionCodes.sales_rep).not.toContain("invoice.create");
  });
});
