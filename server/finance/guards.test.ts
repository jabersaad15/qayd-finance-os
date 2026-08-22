import { describe, expect, it } from "vitest";
import { assertAuditAppendOnly, assertJournalMutable } from "./guards";

describe("financial immutability guards", () => {
  it("يمنع تعديل القيود المرحلة والملغاة", () => {
    expect(() => assertJournalMutable("posted")).toThrow(/لا يمكن تعديل/);
    expect(() => assertJournalMutable("voided")).toThrow(/لا يمكن تعديل/);
    expect(() => assertJournalMutable("draft")).not.toThrow();
  });
  it("يفرض إلحاق سجل التدقيق فقط", () => {
    expect(() => assertAuditAppendOnly("insert")).not.toThrow();
    expect(() => assertAuditAppendOnly("update")).toThrow(/لا يسمح/);
    expect(() => assertAuditAppendOnly("delete")).toThrow(/لا يسمح/);
  });
});
