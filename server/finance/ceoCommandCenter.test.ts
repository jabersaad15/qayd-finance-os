import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultPermissions, rolePermissionCodes } from "./rbac";

describe("CEO Executive Command Center", () => {
  const routerSource = readFileSync(resolve(process.cwd(), "server/routers/ceo.ts"), "utf8");
  const workspaceSource = readFileSync(resolve(process.cwd(), "client/src/components/CeoCommandCenterWorkspace.tsx"), "utf8");

  it("يوفر صلاحيات القيادة التنفيذية ويمنع خلطها بصلاحيات المحاسب", () => {
    const ceoPermissions = rolePermissionCodes.general_manager ?? [];
    expect(ceoPermissions).toEqual(expect.arrayContaining([
      "executive.command_center.view",
      "executive.company_sales_summary.view",
      "executive.company_financial_summary.view",
      "executive.company_operations_summary.view",
      "executive.approval.decide",
      "executive.risks.view",
      "executive.opportunities.view",
    ]));
    expect(defaultPermissions.map((permission) => permission.code)).toEqual(expect.arrayContaining(ceoPermissions));
    expect(rolePermissionCodes.company_admin ?? []).not.toContain("executive.command_center.view");
  });

  it("يستخدم بيانات فعلية قابلة للتتبع ويطبق Maker-Checker على الاعتمادات", () => {
    expect(routerSource).toContain("invoices.grandTotal");
    expect(routerSource).toContain("journalEntries.status");
    expect(routerSource).toContain("salesOpportunities.expectedValue");
    expect(routerSource).toContain("request.requestedByUserId === ctx.user.id");
    expect(routerSource).toContain("executiveApprovalActions");
    expect(routerSource).toContain("aiAnalysis:");
    expect(routerSource).toContain("لا تخترع أرقاماً أو وقائع");
    expect(workspaceSource).toContain("مصادر الأرقام");
    expect(workspaceSource).toContain("يحتاج قراري اليوم");
    expect(workspaceSource).toContain("تصدير Excel");
    expect(workspaceSource).toContain("AI Executive Analysis");
  });
});
