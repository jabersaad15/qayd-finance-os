import { describe, expect, it } from "vitest";
import { assertMemberChangeAllowed, canManageCompanyMembers, isManagedRoleCode } from "./memberManagement";

describe("member management controls", () => {
  it("يحصر إدارة الأعضاء بالرئيس التنفيذي أو مدير المنصة", () => {
    expect(canManageCompanyMembers("company_admin")).toBe(true);
    expect(canManageCompanyMembers("cfo")).toBe(false);
  });

  it("يمنع تعطيل آخر مدير ويمنع تعديل الحساب الذاتي", () => {
    expect(() => assertMemberChangeAllowed({ actorUserId: 1, targetUserId: 1, activeOwnerCount: 2 })).toThrow("لا يمكن تعديل دورك");
    expect(() => assertMemberChangeAllowed({ actorUserId: 1, targetUserId: 2, targetRoleCode: "company_admin", nextStatus: "disabled", activeOwnerCount: 1 })).toThrow("آخر مدير");
  });

  it("يسمح فقط بأدوار التشغيل المعتمدة", () => {
    expect(isManagedRoleCode("accountant")).toBe(true);
    expect(isManagedRoleCode("super_admin")).toBe(false);
  });
});
