import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { rolePermissionCodes } from "./rbac";
import { invoiceIssueRoles, canUseCompanyCapability } from "./roleAccess";

const workspaceSource = readFileSync(resolve(process.cwd(), "client/src/components/SalesSupervisorWorkspace.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const salesRouterSource = readFileSync(resolve(process.cwd(), "server/routers/sales.ts"), "utf8");

describe("Sales Supervisor workspace security", () => {
  it("يمنح المشرف صلاحيات الإشراف البيعي دون الصلاحيات المالية أو الإدارية", () => {
    expect(rolePermissionCodes.sales).toContain("sales.representatives.view.all");
    expect(rolePermissionCodes.sales).toContain("sales.lead.assign");
    expect(rolePermissionCodes.sales).toContain("sales.opportunities.reassign");
    expect(rolePermissionCodes.sales).toContain("sales.performance.view.all");
    expect(rolePermissionCodes.sales).not.toContain("invoice.create");
    expect(rolePermissionCodes.sales).not.toContain("company.manage");
    expect(canUseCompanyCapability("sales", invoiceIssueRoles)).toBe(false);
  });

  it("يحتوي على لوحة الشركة ومركز التوزيع والتدخلات اليومية", () => {
    expect(workspaceSource).toContain("SALES SUPERVISOR DESK");
    expect(workspaceSource).toContain("Lead Distribution Center");
    expect(workspaceSource).toContain("ماذا يحتاج تدخلي اليوم؟");
    expect(workspaceSource).toContain("Company Sales Pipeline");
    expect(workspaceSource).toContain("reassignSalesOpportunity");
  });

  it("يحصر واجهة المشرف في قسم المبيعات ويمنع API المالية المباشرة", () => {
    expect(layoutSource).toContain('sales: ["/", "/sales"]');
    expect(salesRouterSource).toContain("function rejectFinancialSalesRole");
    expect(salesRouterSource).toContain('if (["sales_rep", "sales"].includes(roleCode))');
    expect(salesRouterSource).toContain("reassignSalesOpportunity");
  });
});
