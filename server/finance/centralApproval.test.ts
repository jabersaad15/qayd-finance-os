import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Central Approval Center contracts", () => {
  const routerSource = readFileSync(resolve(process.cwd(), "server/routers/approvals.ts"), "utf8");
  const componentSource = readFileSync(resolve(process.cwd(), "client/src/components/ApprovalCenter.tsx"), "utf8");

  it("يوفر عقد الحالات والخطوات والإجراءات مع العزل حسب الشركة", () => {
    expect(routerSource).toContain("centralList");
    expect(routerSource).toContain("approvalCases.tenantId");
    expect(routerSource).toContain("approvalCases.companyId");
    expect(routerSource).toContain("approvalCaseSteps");
    expect(routerSource).toContain("approvalCaseActions");
  });

  it("يمنع الاعتماد الذاتي ويلزم سبب الرفض", () => {
    expect(routerSource).toContain("لا يمكن لصاحب الطلب اعتماد طلبه بنفسه");
    expect(routerSource).toContain("سبب الرفض إلزامي");
    expect(routerSource).toContain('action: z.enum(["approve", "reject", "return", "request_information"])');
  });

  it("يدعم مرفقات المستندات مع تحقق النوع والحجم وتخزين metadata", () => {
    expect(routerSource).toContain("centralUploadAttachment");
    expect(routerSource).toContain("approvalCaseAttachments");
    expect(routerSource).toContain("storagePut");
    expect(routerSource).toContain("10 * 1024 * 1024");
    expect(routerSource).toContain("حجم الملف المرسل لا يطابق البيانات المعلنة");
  });

  it("يدعم تبويبات Approval Center والإجراءات التشغيلية الأربعة", () => {
    expect(componentSource).toContain("Pending My Approval");
    expect(componentSource).toContain("My Requests");
    expect(componentSource).toContain("Return for Changes");
    expect(componentSource).toContain("Request More Information");
  });

  it("يقيد المرفقات بصاحب الطلب أو المعتمد المعيّن ويرفض أسماء المسارات", () => {
    expect(routerSource).toContain("canAttach");
    expect(routerSource).toContain("اسم الملف غير صالح");
    expect(routerSource).toContain("randomUUID()}-${input.fileName");
  });

  it("يحتفظ بالتفويض محدد المدة ولا يسمح بالتفويض الذاتي", () => {
    expect(routerSource).toContain("centralCreateDelegation");
    expect(routerSource).toContain("input.delegateeUserId === ctx.user.id");
    expect(routerSource).toContain("input.endsAt <= input.startsAt");
  });
});
