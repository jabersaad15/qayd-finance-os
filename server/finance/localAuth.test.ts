import { describe, expect, it } from "vitest";
import { localCredentialsMatch } from "../_core/localAuth";

describe("external local admin credentials", () => {
  const expected = { email: "admin@consedra.com", password: "correct-horse-battery-staple" };

  it("يقبل البريد دون حساسية لحالة الأحرف وكلمة المرور المطابقة فقط", () => {
    expect(localCredentialsMatch({ email: "ADMIN@CONSEDRA.COM", password: "correct-horse-battery-staple" }, expected)).toBe(true);
  });

  it("يرفض كلمة مرور أو بريد مدير غير مطابقين", () => {
    expect(localCredentialsMatch({ email: expected.email, password: "wrong" }, expected)).toBe(false);
    expect(localCredentialsMatch({ email: "other@consedra.com", password: expected.password }, expected)).toBe(false);
  });
});
