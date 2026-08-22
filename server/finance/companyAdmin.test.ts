import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rolePermissionCodes } from "./rbac";

describe("Company Admin workspace", () => {
  const routerSource = readFileSync(resolve(process.cwd(), "server/routers/companyAdmin.ts"), "utf8");
  const workspaceSource = readFileSync(resolve(process.cwd(), "client/src/components/CompanyAdminWorkspace.tsx"), "utf8");
  const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
  const mainWorkspaceSource = readFileSync(resolve(process.cwd(), "client/src/pages/Workspace.tsx"), "utf8");
  const rbacSource = readFileSync(resolve(process.cwd(), "server/routers/rbac.ts"), "utf8");
  const roleSource = readFileSync(resolve(process.cwd(), "server/finance/rbac.ts"), "utf8");

  it("يملك نطاق الإدارة فقط ولا يرث صلاحيات المالية أو القيادة التنفيذية", () => {
    const permissions = rolePermissionCodes.company_admin ?? [];
    expect(permissions).toEqual(expect.arrayContaining(["admin.dashboard.view", "admin.users.manage", "admin.security.view", "admin.data_export.request"]));
    expect(permissions).not.toContain("journal.post");
    expect(permissions).not.toContain("executive.command_center.view");
    expect(permissions).not.toContain("sales.opportunities.view.all");
  });

  it("يوفر لوحة الإدارة والحماية الخادمية والطلبات الحساسة المسجلة", () => {
    expect(routerSource).toContain("requireCompanyAdmin");
    expect(routerSource).toContain("adminDataExportRequests");
    expect(routerSource).toContain("adminSupportAccessGrants");
    expect(routerSource).toContain("هذه العملية متاحة لمدير النظام");
    expect(workspaceSource).toContain("لوحة إدارة الشركة");
    expect(workspaceSource).toContain("يحتاج انتباهي");
    expect(workspaceSource).toContain("Administrative Audit Log");
    expect(workspaceSource).toContain("مركز التكاملات");
    expect(workspaceSource).toContain("إعدادات النظام والإشعارات");
    expect(rbacSource).toContain("createCustomRole");
    expect(rbacSource).toContain("deactivateCustomRole");
  });

  it("لا يجعل مؤشرات الاشتراك الاختيارية شرطاً لتحميل لوحة الإدارة الأساسية", () => {
    expect(routerSource).toContain("Optional subscription/usage tables may not exist");
    expect(routerSource).toContain("const integrationsCount = 0");
    expect(routerSource).toContain("const usage: typeof tenantUsageCounters.$inferSelect[] = []");
  });

  it("يعرض للمالك الشامل كل أقسام النظام ويفتح لوحة الإدارة", () => {
    expect(layoutSource).toContain('roleCode === "super_admin" ? menuItems');
    expect(mainWorkspaceSource).toContain('roleCode === "super_admin" ? <CompanyAdminWorkspace');
    expect(roleSource).toContain('super_admin: defaultPermissions.map');
  });
});
