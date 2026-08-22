import { describe, expect, it } from "vitest";
import { getOfficialDocumentStatus, getOfficialSellerIdentity } from "../../shared/officialDocumentPresentation";

describe("official document presentation", () => {
  it("يعرض هوية البائع من بيانات الشركة المرتبطة بالمستند لا من قيم ثابتة", () => {
    expect(getOfficialSellerIdentity({ legalNameAr: "شركة العميلة للتقنية", commercialRegistration: "1010999999", unifiedNumber: "7000000000", vatNumber: "300000000000003", nationalAddress: "الرياض، المملكة العربية السعودية" })).toEqual({ legalNameAr: "شركة العميلة للتقنية", registrationNumber: "1010999999", vatNumber: "300000000000003", nationalAddress: "الرياض، المملكة العربية السعودية" });
  });

  it("يترجم حالة المستند الرسمية ويحافظ على الحالة غير المعروفة كما هي", () => {
    expect(getOfficialDocumentStatus("approved")).toBe("معتمدة");
    expect(getOfficialDocumentStatus("review_pending")).toBe("review_pending");
  });
});
