import { describe, expect, it } from "vitest";
import { canCustomerRespondToQuotation } from "../routers/customerPortal";

describe("customer portal quotation response guard", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  it("يسمح بالرد على عرض مرسل غير منتهٍ", () => {
    expect(canCustomerRespondToQuotation("sent", new Date("2026-08-20T00:00:00.000Z"), now)).toBe(true);
    expect(canCustomerRespondToQuotation("sent", null, now)).toBe(true);
  });

  it("يرفض الرد على عرض غير مرسل أو منتهٍ", () => {
    expect(canCustomerRespondToQuotation("draft", new Date("2026-08-20T00:00:00.000Z"), now)).toBe(false);
    expect(canCustomerRespondToQuotation("accepted", null, now)).toBe(false);
    expect(canCustomerRespondToQuotation("sent", new Date("2026-08-16T23:59:59.000Z"), now)).toBe(false);
  });
});
