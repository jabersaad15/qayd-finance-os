import { describe, expect, it } from "vitest";
import { toSingleCompanyConfigureInput } from "../../client/src/lib/singleCompanySetup";

describe("single-company setup submission", () => {
  it("يرسل الرقم الضريبي والفترة فقط ولا يرسل أي حقول خاصة بالفروع", () => {
    const input = toSingleCompanyConfigureInput({ tenantId: 1, companyId: 1, vatNumber: "314352144600003", city: "الرياض", fiscalYearStartMonth: "1", periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    expect(input).toEqual({ tenantId: 1, companyId: 1, vatNumber: "314352144600003", city: "الرياض", fiscalYearStartMonth: 1, periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    expect(input).not.toHaveProperty("branchCode");
    expect(input).not.toHaveProperty("branchNameAr");
  });
});
