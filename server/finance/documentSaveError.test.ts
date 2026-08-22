import { describe, expect, it } from "vitest";
import { documentSaveErrorMessage } from "../../shared/documentSaveError";

describe("document save error message", () => {
  it("لا يكشف استعلامات قاعدة البيانات عند فشل حفظ عرض السعر", () => {
    const message = documentSaveErrorMessage("Failed query: insert into `quotations` (`scopeOfWork`)", "quotation");
    expect(message).toContain("تعذر حفظ عرض السعر");
    expect(message).not.toContain("insert into");
  });

  it("يفسر تعارض رقم المستند برسالة قابلة للتنفيذ", () => {
    expect(documentSaveErrorMessage("Duplicate entry Q-2026-001", "quotation")).toContain("رقم المستند محجوز");
  });
});
