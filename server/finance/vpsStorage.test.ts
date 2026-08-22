import { describe, expect, it } from "vitest";
import { getLocalStorageFilePath } from "../storage";

describe("VPS local storage safety", () => {
  it("يرفض مفاتيح التخزين التي تحاول الخروج من مسار الحجم الدائم", () => {
    expect(() => getLocalStorageFilePath("../private-key")).toThrow(/invalid|outside/i);
  });

  it("يبني مساراً ثابتاً لمستند الشركة داخل حجم التخزين", () => {
    expect(getLocalStorageFilePath("tenants/1/contracts/document-abc.pdf")).toContain("tenants/1/contracts/document-abc.pdf");
  });
});
