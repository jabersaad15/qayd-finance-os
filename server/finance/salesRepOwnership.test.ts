import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { customers, internalNotifications, salesCommissionEntries, salesCommissionRules, salesCustomerAttributions, salesVisits } from "../../drizzle/schema";
import { calculateSalesCommissionAmount, isLargeAccountTier } from "../routers/sales";
import { managedRoleCodes } from "./memberManagement";
import { defaultRoles, rolePermissionCodes } from "./rbac";

describe("sales representative ownership and commissions", () => {
  it("يعرّف دور ممثل مبيعات بصلاحيات CRM دون اعتماد مالي", () => {
    expect(managedRoleCodes).toContain("sales_rep");
    expect(defaultRoles.find((role) => role.code === "sales_rep")?.nameAr).toBe("ممثل مبيعات");
    expect(rolePermissionCodes.sales_rep).toEqual(expect.arrayContaining(["crm.customer.create", "crm.visit.create", "sales.commission.view"]));
    expect(rolePermissionCodes.sales_rep).not.toContain("invoice.approve");
    expect(rolePermissionCodes.sales_rep).not.toContain("journal.post");
  });

  it("يحفظ سجل الإسناد والزيارة وقيد العمولة ببيانات تاريخية", () => {
    expect(getTableColumns(salesCustomerAttributions).salesRepUserId).toBeDefined();
    expect(getTableColumns(salesCustomerAttributions).firstContactAt).toBeDefined();
    expect(getTableColumns(salesVisits).visitedAt).toBeDefined();
    expect(getTableColumns(salesVisits).outcome).toBeDefined();
    expect(getTableColumns(customers).accountTier).toBeDefined();
    expect(getTableColumns(internalNotifications).eventType).toBeDefined();
    expect(getTableColumns(internalNotifications).readAt).toBeDefined();
    expect(getTableColumns(salesCommissionRules).rateBps).toBeDefined();
    expect(getTableColumns(salesCommissionEntries).contractId).toBeDefined();
    expect(getTableColumns(salesCommissionEntries).status).toBeDefined();
  });

  it("ينبه الإدارة للحسابات الكبرى والاستراتيجية فقط", () => {
    expect(isLargeAccountTier("large")).toBe(true);
    expect(isLargeAccountTier("strategic")).toBe(true);
    expect(isLargeAccountTier("standard")).toBe(false);
  });

  it("يحسب عمولة العقد بدقة من القيمة ونقاط الأساس", () => {
    expect(calculateSalesCommissionAmount("125000.000000", 250)).toBe("3125.000000");
    expect(calculateSalesCommissionAmount("1000", 10000)).toBe("1000.000000");
  });
});
