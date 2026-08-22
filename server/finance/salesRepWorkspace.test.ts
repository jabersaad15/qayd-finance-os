import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rolePermissionCodes } from "./rbac";

const salesRouterSource = readFileSync(resolve(process.cwd(), "server/routers/sales.ts"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const workspaceSource = readFileSync(resolve(process.cwd(), "client/src/components/SalesRepWorkspace.tsx"), "utf8");

describe("Sales Representative workspace security", () => {
  it("يمنح ممثل المبيعات صلاحيات CRM وعروض الأسعار المسندة دون صلاحيات مالية", () => {
    const permissions = rolePermissionCodes.sales_rep;
    expect(permissions).toEqual(expect.arrayContaining([
      "crm.customer.view.assigned",
      "crm.lead.create",
      "crm.lead.edit.assigned",
      "crm.opportunity.create",
      "crm.opportunity.edit.assigned",
      "crm.activity.create",
      "crm.task.create",
      "quotation.create.assigned",
      "quotation.send.assigned",
      "discount.request",
      "sales.performance.view",
    ]));
    expect(permissions).not.toEqual(expect.arrayContaining(["invoice.create", "invoice.approve", "journal.create", "journal.post", "payment.create", "payment.approve", "company.manage", "document.manage"]));
  });

  it("يفرض ملكية الممثل على لوحة الأداء والزيارات والإسنادات والبيانات المرتبطة بالعميل", () => {
    expect(salesRouterSource).toContain('if (scopeAccess.roleCode === "sales_rep" && input.salesRepUserId !== ctx.user.id)');
    expect(salesRouterSource).toContain('const ownerId = scope.roleCode === "sales_rep" ? ctx.user.id : input.salesRepUserId;');
    expect(salesRouterSource).toContain("accessOwnedSalesCustomer");
    expect(salesRouterSource).toContain("scopedSalesOwner(scope.roleCode, ctx.user.id, salesActivities.ownerUserId)");
  });

  it("يعرض لممثل المبيعات روابط Workspace البيعية فقط", () => {
    expect(layoutSource).toContain('label: "العملاء المحتملون"');
    expect(layoutSource).toContain('label: "عروض الأسعار"');
    expect(layoutSource).toContain('label: "المهام والمتابعات"');
    expect(layoutSource).toContain('roleCode === "sales_rep" ? salesRepMenuItems');
    expect(layoutSource).not.toContain('salesRepMenuItems, { icon: ReceiptText, label: "قسم الفوترة"');
    expect(workspaceSource).toContain('id="sales-rep-opportunities"');
    expect(workspaceSource).toContain('id="sales-rep-quotations"');
    expect(workspaceSource).toContain('id="sales-rep-notifications"');
  });

  it("يمنع مسارات الفوترة والعمولة الإدارية من ممثل المبيعات", () => {
    expect(salesRouterSource).toContain("accessCompany(ctx.user.id, input.tenantId, input.companyId, invoiceIssueRoles)");
    expect(salesRouterSource).toContain("accessCompany(ctx.user.id, input.tenantId, input.companyId, salesCommissionAdminRoles)");
    expect(rolePermissionCodes.sales_rep).not.toContain("invoice.create");
    expect(rolePermissionCodes.sales_rep).not.toContain("payment.create");
  });
});
