import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultRoles, rolePermissionCodes } from "./rbac";

describe("Executive Assistant role", () => {
  const routerSource = readFileSync(resolve(process.cwd(), "server/routers/executiveAssistant.ts"), "utf8");
  const componentSource = readFileSync(resolve(process.cwd(), "client/src/components/ExecutiveAssistantWorkspace.tsx"), "utf8");
  const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

  it("يعرف دوراً مستقلاً بصلاحيات متابعة تنفيذية فقط", () => {
    expect(defaultRoles.find((role) => role.code === "executive_assistant")?.nameAr).toContain("مساعد المدير التنفيذي");
    const permissions = rolePermissionCodes.executive_assistant ?? [];
    expect(permissions).toEqual(expect.arrayContaining(["executive.dashboard.view", "executive.decisions.track", "executive.meeting.create", "executive.daily_brief.generate"]));
    expect(permissions).not.toEqual(expect.arrayContaining(["invoice.approve", "journal.post", "payment.approve", "company.manage", "period.manage", "sales.lead.assign"]));
  });

  it("يحتوي على عقد API وواجهة المتابعة والموجز التنفيذي", () => {
    for (const procedure of ["dashboard", "createDecision", "updateDecision", "createRequest", "updateRequest", "createMeeting", "updateMeeting", "grantDelegation", "listDocuments", "generateBrief"]) expect(routerSource).toContain(`${procedure}:`);
    for (const label of ["مساعد المدير التنفيذي", "يحتاج متابعة اليوم", "Decision", "Daily CEO Brief", "قرار تنفيذي", "طلب المدير التنفيذي", "اجتماع تنفيذي", "حدود الدور"]) expect(componentSource).toContain(label);
    expect(layoutSource).toContain("executiveAssistantMenuItems");
    expect(layoutSource).toContain('roleCode === "executive_assistant"');
  });
});
