import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultRoles, rolePermissionCodes } from "./rbac";

describe("Operations Manager role", () => {
  const routerSource = readFileSync(resolve(process.cwd(), "server/routers/operationsControl.ts"), "utf8");
  const componentSource = readFileSync(resolve(process.cwd(), "client/src/components/OperationsManagerWorkspace.tsx"), "utf8");
  const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

  it("يعرف دوراً تشغيلياً مستقلاً ولا يرث الصلاحيات المالية أو البيعية", () => {
    expect(defaultRoles.find((role) => role.code === "operations_manager")?.nameAr).toContain("مدير العمليات");
    const permissions = rolePermissionCodes.operations_manager ?? [];
    expect(permissions).toContain("operations.dashboard.view");
    expect(permissions).toContain("operations.issue.manage");
    expect(permissions).toContain("operations.summary.generate");
    expect(permissions).not.toContain("journal.post");
    expect(permissions).not.toContain("payment.approve");
    expect(permissions).not.toContain("company.manage");
    expect(permissions).not.toContain("sales.lead.assign");
  });

  it("يحتوي على مسارات مركز العمليات الأساسية", () => {
    for (const procedure of ["dashboard", "createTask", "updateTask", "createIssue", "updateIssue", "createCorrectiveAction", "createRequest", "report"]) expect(routerSource).toContain(`${procedure}:`);
    for (const label of ["غرفة التحكم التشغيلية", "يحتاج تدخلي اليوم", "مهمة تشغيلية", "مشكلة أو حادث", "طلب داخلي", "مركز العمليات"]) expect(componentSource).toContain(label);
    expect(layoutSource).toContain("operationsManagerMenuItems");
    expect(layoutSource).toContain('roleCode === "operations_manager"');
  });
});
