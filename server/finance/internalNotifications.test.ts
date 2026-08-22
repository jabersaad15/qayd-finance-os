import { describe, expect, it } from "vitest";
import { teamInvitationNotification, teamRoleChangedNotification } from "./internalNotifications";

describe("internal team notifications", () => {
  it("ينشئ إشعار دعوة عربي يتضمن العضو والدور", () => {
    const notification = teamInvitationNotification({ tenantId: 1, companyId: 2, invitationId: 3, email: "accountant@consedra.sa", roleName: "محاسب" });
    expect(notification.titleAr).toBe("دعوة عضو جديدة");
    expect(notification.bodyAr).toContain("accountant@consedra.sa");
    expect(notification.bodyAr).toContain("محاسب");
  });

  it("ينشئ إشعار تغيير الدور موجهاً للعضو", () => {
    const notification = teamRoleChangedNotification({ tenantId: 1, companyId: 2, memberId: 3, recipientUserId: 9, roleName: "المدير المالي" });
    expect(notification.recipientUserId).toBe(9);
    expect(notification.bodyAr).toContain("المدير المالي");
  });
});
