import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { executiveAssignments, executiveWeeklyReports, salesWeeklyRepNotes } from "../../drizzle/schema";
import { rolePermissionCodes } from "./rbac";

describe("executive coordination access", () => {
  it("يحتوي سجل التكليف على المسؤول والموعد والأولوية والحالة والتحديث الأخير", () => {
    const columns = getTableColumns(executiveAssignments);
    expect(columns.assignedToUserId).toBeDefined();
    expect(columns.dueDate).toBeDefined();
    expect(columns.priority).toBeDefined();
    expect(columns.status).toBeDefined();
    expect(columns.latestUpdate).toBeDefined();
  });

  it("يحتوي التقرير الأسبوعي على عناصر القالب المطلوبة", () => {
    const columns = getTableColumns(executiveWeeklyReports);
    expect(columns.weekStart).toBeDefined();
    expect(columns.weekEnd).toBeDefined();
    expect(columns.summary).toBeDefined();
    expect(columns.achievements).toBeDefined();
    expect(columns.blockers).toBeDefined();
    expect(columns.decisionsNeeded).toBeDefined();
    expect(columns.nextWeekPlan).toBeDefined();
  });

  it("يحفظ توجيه الممثل حسب الشركة والفترة الأسبوعية", () => {
    const columns = getTableColumns(salesWeeklyRepNotes);
    expect(columns.salesRepUserId).toBeDefined();
    expect(columns.authorUserId).toBeDefined();
    expect(columns.weekStart).toBeDefined();
    expect(columns.weekEnd).toBeDefined();
    expect(columns.note).toBeDefined();
  });

  it("يمنح المساعد صلاحيات التنسيق فقط ولا يمنحه صلاحيات مالية أو إدارة أعضاء", () => {
    const permissions = rolePermissionCodes.ceo_assistant;
    expect(permissions).toEqual(expect.arrayContaining(["executive.dashboard.view", "executive.followup.create", "executive.alert.view", "office.coordination.manage"]));
    expect(permissions).not.toEqual(expect.arrayContaining(["invoice.create", "invoice.approve", "journal.create", "journal.post", "payment.create", "payment.approve", "company.manage"]));
  });
});
