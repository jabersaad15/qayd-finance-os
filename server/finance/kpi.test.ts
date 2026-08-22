import { describe, expect, it } from "vitest";
import { isKpiVisible } from "../routers/kpi";

describe("KPI visibility scope", () => {
  it("يعرض مؤشر الدور للمطابق فقط ولا يعرضه لدور آخر", () => {
    const definition = { assignedUserId: null, roleCode: "sales_rep" };
    expect(isKpiVisible(definition, 10, "sales_rep")).toBe(true);
    expect(isKpiVisible(definition, 10, "accountant")).toBe(false);
  });

  it("يعرض المؤشر المسند لموظف بعينه حتى لو اختلف دوره", () => {
    const definition = { assignedUserId: 10, roleCode: "accountant" };
    expect(isKpiVisible(definition, 10, "sales_rep")).toBe(true);
    expect(isKpiVisible(definition, 11, "accountant")).toBe(false);
  });
});
