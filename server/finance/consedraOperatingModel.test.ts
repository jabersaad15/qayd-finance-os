import { describe, expect, it } from "vitest";
import { consedraOperatingFlow, consedraRoleModel } from "../../shared/consedraOperatingModel";

describe("consedra operating model", () => {
  it("يفصل إصدار الفاتورة عن إعداد العرض للمحاسب والمبيعات", () => {
    expect(consedraRoleModel.accountant.boundary).toContain("لا يصدر فاتورة نهائية");
    expect(consedraRoleModel.sales.boundary).toContain("لا يصدر فاتورة نهائية");
  });

  it("يوثق تسلسل العمل من النطاق إلى الاعتماد ثم الترحيل والمراجعة", () => {
    expect(consedraOperatingFlow.map((stage) => stage.step)).toEqual(["01", "02", "03"]);
  });
});
