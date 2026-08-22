import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultRoles, rolePermissionCodes } from "./rbac";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers/administrative.ts"), "utf8");
const componentSource = readFileSync(resolve(process.cwd(), "client/src/components/AdministrativeAssistantWorkspace.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("Administrative Assistant workspace", () => {
  it("يعرض دوراً إدارياً مستقلاً ولا يرث صلاحيات المالية", () => {
    expect(defaultRoles.find((role) => role.code === "ceo_assistant")?.nameAr).toContain("مساعد");
    const permissions = rolePermissionCodes.ceo_assistant ?? [];
    expect(permissions).toContain("executive.followup.create");
    expect(permissions).toContain("office.coordination.manage");
    expect(permissions).not.toContain("invoice.approve");
    expect(permissions).not.toContain("payment.approve");
    expect(permissions).not.toContain("journal.post");
    expect(permissions).not.toContain("company.manage");
  });

  it("يحتوي على واجهات المهام والاجتماعات والمراسلات والطلبات والتذكيرات", () => {
    for (const procedure of ["dashboard", "createTask", "updateTask", "createMeeting", "saveMinutes", "createCorrespondence", "updateCorrespondence", "createRequest", "registerDocument", "listDocuments", "search", "report", "createReminder", "timeline"]) expect(routerSource).toContain(`${procedure}:`);
    for (const label of ["مساحة المساعد الإداري", "يحتاج متابعتي اليوم", "Administrative Tasks", "Meetings وMeeting Minutes", "المراسلات والخطابات", "Administrative Requests", "المستندات الإدارية", "البحث الإداري الموحد"]) expect(componentSource).toContain(label);
  });

  it("يحصر الشريط الجانبي للمساعد الإداري في المساحة الإدارية", () => {
    expect(layoutSource).toContain("administrativeAssistantMenuItems");
    expect(layoutSource).toContain('ceo_assistant: ["/"]');
    expect(layoutSource).toContain('roleCode === "ceo_assistant" ? administrativeAssistantMenuItems');
  });

  it("يستخدم مفاتيح فريدة لعناصر الشريط حتى عند تكرار المسار", () => {
    expect(layoutSource).toContain('const itemKey = `${item.path}:${item.anchor ?? "root"}:${index}`');
    expect(layoutSource).toContain("<SidebarMenuItem key={itemKey}>");
    expect(layoutSource).not.toContain("<SidebarMenuItem key={item.path}>");
  });

  it("يرفض اعتماد المراسلات الحساسة من مسار المساعد الإداري", () => {
    expect(routerSource).toContain("لا يستطيع المساعد الإداري اعتماد المراسلات الحساسة");
    expect(routerSource).toContain('if (["approved", "sent"].includes(input.status))');
  });
});
