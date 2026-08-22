import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mutation: () => ({ isPending: false, mutate: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
    auth: { localLogin: { useMutation: mocks.mutation } },
  },
}));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">ليلي</button> }));
vi.mock("wouter", () => ({ useLocation: () => ["/login", vi.fn()] }));

import LocalLogin from "../../client/src/pages/LocalLogin";

describe("local login screen", () => {
  it("يعرض نموذج الدخول الكامل بدلاً من بوابة زر واحدة", () => {
    const html = renderToStaticMarkup(<LocalLogin />);
    expect(html).toContain("البريد الإلكتروني أو اسم المستخدم");
    expect(html).toContain('id="identifier"');
    expect(html).toContain('id="password"');
    expect(html).toContain("أوافق على");
    expect(html).toContain("الشروط والأحكام");
    expect(html).toContain("سياسة الخصوصية");
    expect(html).toContain("تسجيل الدخول");
    expect(html).toContain("نسيت كلمة المرور؟");
    expect(html).not.toContain("دخول آمن إلى المنصة");
  });
});
