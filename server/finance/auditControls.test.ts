import { describe, expect, it } from "vitest";
import { canActivateAuditEngagement, canApproveAuditReopen, canFinalizeAuditReport, canModifyAuditFinalReport, nextIndependenceDeclarationStatus } from "../../shared/auditControls";

describe("audit final report controls", () => {
  it("يمنع تعديل تقرير المراجع بعد الإقفال", () => {
    expect(canModifyAuditFinalReport(false)).toBe(true);
    expect(canModifyAuditFinalReport(true)).toBe(false);
  });

  it("يتطلب توقيعاً رقمياً قبل الإقفال النهائي", () => {
    expect(canFinalizeAuditReport(false, false)).toBe(false);
    expect(canFinalizeAuditReport(false, true)).toBe(true);
    expect(canFinalizeAuditReport(true, true)).toBe(false);
  });

  it("يحصر اعتماد إعادة فتح الفترة في CFO أو المسؤول المخول", () => {
    expect(canApproveAuditReopen("external_auditor")).toBe(false);
    expect(canApproveAuditReopen("cfo")).toBe(true);
    expect(canApproveAuditReopen("company_admin")).toBe(true);
  });

  it("لا يفعّل ارتباط المراجعة قبل إقرار الاستقلالية ويسجل التحديثات بوضوح", () => {
    expect(canActivateAuditEngagement(false)).toBe(false);
    expect(canActivateAuditEngagement(true)).toBe(true);
    expect(nextIndependenceDeclarationStatus(false, false)).toBe("declared");
    expect(nextIndependenceDeclarationStatus(true, false)).toBe("updated");
    expect(nextIndependenceDeclarationStatus(true, true)).toBe("conflict_disclosed");
  });
});
