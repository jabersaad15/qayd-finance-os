import { describe, expect, it } from "vitest";
import { validateCustomerIdentity } from "../routers/sales";

describe("customer identity validation", () => {
  it("allows individuals without VAT or unified number", () => {
    expect(validateCustomerIdentity({ customerType: "individual", vatNumber: undefined, unifiedNumber: undefined })).toBe(true);
  });

  it("requires a 15-digit VAT number and 10-digit unified number for companies", () => {
    expect(validateCustomerIdentity({ customerType: "company", vatNumber: "310000000000003", unifiedNumber: "7001234567" })).toBe(true);
    expect(validateCustomerIdentity({ customerType: "company", vatNumber: "123", unifiedNumber: "7001234567" })).toBe(false);
    expect(validateCustomerIdentity({ customerType: "company", vatNumber: "310000000000003", unifiedNumber: "123" })).toBe(false);
  });
});
