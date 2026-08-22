import { describe, expect, it } from "vitest";
import { assertAccountParentAllowed } from "./chartOfAccounts";

const accounts = [
  { id: 1, parentId: null, accountType: "asset" },
  { id: 2, parentId: 1, accountType: "asset" },
  { id: 3, parentId: 2, accountType: "asset" },
  { id: 4, parentId: null, accountType: "revenue" },
];

describe("account hierarchy guard", () => {
  it("يقبل الأب من النوع نفسه", () => expect(() => assertAccountParentAllowed(accounts, 3, 1, "asset")).not.toThrow());
  it("يرفض أن يكون الحساب أباً لنفسه أو تحت فرع تابع له", () => {
    expect(() => assertAccountParentAllowed(accounts, 2, 2, "asset")).toThrow(/نفسه/);
    expect(() => assertAccountParentAllowed(accounts, 1, 3, "asset")).toThrow(/الفرعية/);
  });
  it("يرفض الأب الغائب أو المخالف لنوع الحساب", () => {
    expect(() => assertAccountParentAllowed(accounts, undefined, 99, "asset")).toThrow(/غير موجود/);
    expect(() => assertAccountParentAllowed(accounts, undefined, 4, "asset")).toThrow(/يطابق نوع الحساب/);
  });
});
