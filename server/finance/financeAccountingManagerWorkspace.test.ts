import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { rolePermissionCodes } from "./rbac";
import { financeAdministrationRoles, financeAccountingManagerRoles, isFinanceAccountingManager } from "./roleAccess";

const workspaceSource = readFileSync(resolve(process.cwd(), "client/src/components/FinanceAccountingManagerWorkspace.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const financeRouterSource = readFileSync(resolve(process.cwd(), "server/routers/finance.ts"), "utf8");
const approvalsRouterSource = readFileSync(resolve(process.cwd(), "server/routers/approvals.ts"), "utf8");

describe("Finance & Accounting Manager workspace security", () => {
  it("يعامل cfo وfinance_manager كدور موحد بصلاحيات مالية دون Super Admin", () => {
    expect(isFinanceAccountingManager("cfo")).toBe(true);
    expect(isFinanceAccountingManager("finance_manager")).toBe(true);
    expect(financeAccountingManagerRoles).toEqual(["cfo", "finance_manager"]);
    expect(financeAdministrationRoles).toContain("finance_manager");
    expect(rolePermissionCodes.finance_manager).toContain("accounting.approve");
    expect(rolePermissionCodes.finance_manager).toContain("financial.analysis.view");
    expect(rolePermissionCodes.finance_manager).not.toContain("company.manage");
  });

  it("يعرض لوحة الاعتمادات والإقفال والتحليل من بيانات النظام", () => {
    expect(workspaceSource).toContain("Finance & Accounting Manager");
    expect(workspaceSource).toContain("Accounting Work Queue");
    expect(workspaceSource).toContain("Maker–Checker");
    expect(workspaceSource).toContain("trpc.approvals.listPending");
    expect(workspaceSource).toContain("trpc.audit.dashboard");
    expect(workspaceSource).toContain("trpc.operations.trialBalance");
  });

  it("يحصر التنقل واعتماد العمليات ويضع حواجز مالية خادمية", () => {
    expect(layoutSource).toContain('roleCode === "cfo" || roleCode === "finance_manager"');
    expect(layoutSource).toContain('item.path !== "/settings"');
    expect(financeRouterSource).toContain("requireFinanceAdministrator");
    expect(approvalsRouterSource).toContain("financeAdministrationRoles");
    expect(approvalsRouterSource).toContain("لا يمكن لصاحب الطلب اعتماد طلبه بنفسه");
  });
});
