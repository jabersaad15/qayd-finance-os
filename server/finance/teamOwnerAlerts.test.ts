import { describe, expect, it } from "vitest";
import { buildTeamOwnerAlert } from "./teamOwnerAlerts";

describe("team owner alerts", () => {
  it("يبني تنبيهات موجزة للدعوة وتغيير الدور دون بيانات حساسة", () => {
    const invitation = buildTeamOwnerAlert({ event: "invited", subject: "accountant@consedra.sa", roleName: "محاسب" });
    const change = buildTeamOwnerAlert({ event: "role_changed", subject: "محاسب كونسيدرا", roleName: "المدير المالي" });
    expect(invitation.content).toContain("محاسب");
    expect(change.content).toContain("المدير المالي");
    expect(change.content).not.toContain("SQL");
  });
});
