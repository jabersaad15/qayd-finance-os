import { describe, expect, it } from "vitest";
import { isSelectableCostCenter, isSelectableProject } from "../../shared/operationalDimensions";

describe("operational dimensions", () => {
  it("يعرض مركز التكلفة النشط فقط للاستخدام التشغيلي", () => {
    expect(isSelectableCostCenter(true)).toBe(true);
    expect(isSelectableCostCenter(false)).toBe(false);
  });

  it("يمنع اختيار المشاريع المعلقة أو المغلقة في ترحيل المصروف", () => {
    expect(isSelectableProject("active")).toBe(true);
    expect(isSelectableProject("on_hold")).toBe(false);
    expect(isSelectableProject("closed")).toBe(false);
  });
});
