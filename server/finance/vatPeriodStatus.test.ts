import { describe, expect, it } from "vitest";
import { canTransitionVatPeriodStatus } from "../../shared/vatPeriodStatus";

describe("VAT period status transitions", () => {
  it("يسمح بتجهيز فترة مفتوحة ثم إيداعها", () => {
    expect(canTransitionVatPeriodStatus("open", "prepared")).toBe(true);
    expect(canTransitionVatPeriodStatus("prepared", "filed")).toBe(true);
  });

  it("يسمح بالتصحيح قبل الإيداع فقط", () => {
    expect(canTransitionVatPeriodStatus("prepared", "open")).toBe(true);
    expect(canTransitionVatPeriodStatus("filed", "open")).toBe(false);
  });

  it("يمنع تغيير الحالة بعد قفل الفترة", () => {
    expect(canTransitionVatPeriodStatus("locked", "prepared")).toBe(false);
    expect(canTransitionVatPeriodStatus("locked", "locked")).toBe(true);
  });
});
