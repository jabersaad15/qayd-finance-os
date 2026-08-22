import { describe, expect, it } from "vitest";
import { canApproveDocument, defaultPermissions, defaultRoles, rolePermissionCodes } from "./rbac";

describe("RBAC and segregation of duties", () => {
  it("يعرف الأدوار الأساسية والصلاحيات الحساسة", () => {
    expect(defaultRoles).toHaveLength(13);
    expect(defaultPermissions.some((permission) => permission.code === "journal.post")).toBe(true);
    expect(defaultPermissions.some((permission) => permission.code === "audit.signoff.create")).toBe(true);
    expect(rolePermissionCodes.cfo).toContain("audit.reopen.approve");
    expect(rolePermissionCodes.external_auditor).toContain("audit.closing.view");
    expect(rolePermissionCodes.external_auditor).not.toContain("journal.post");
    expect(rolePermissionCodes.read_only).toEqual(["report.view"]);
    expect(defaultRoles.find((role) => role.code === "ceo_assistant")?.nameAr).toContain("المساعد الإداري");
    expect(rolePermissionCodes.ceo_assistant).toEqual(expect.arrayContaining(["executive.dashboard.view", "executive.followup.create", "executive.alert.view", "office.coordination.manage"]));
    expect(rolePermissionCodes.ceo_assistant).not.toEqual(expect.arrayContaining(["invoice.create", "invoice.approve", "journal.create", "journal.post", "payment.create", "payment.approve", "company.manage", "document.manage"]));
  });
  it("يمنع اعتماد المنشئ لنفس المستند عندما تتطلب السياسة الفصل", () => {
    expect(canApproveDocument(9, 9, true)).toBe(false);
    expect(canApproveDocument(9, 10, true)).toBe(true);
    expect(canApproveDocument(9, 9, false)).toBe(true);
  });
});
