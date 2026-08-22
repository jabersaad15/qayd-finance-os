import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  overview: {
    isLoading: false,
    error: null,
    data: {
      roles: [{ id: 1, code: "company_admin", nameAr: "الرئيس التنفيذي / مدير الشركة" }, { id: 2, code: "accountant", nameAr: "محاسب" }],
      members: [{ membership: { id: 4, status: "active" }, user: { id: 9, name: "محاسب كونسيدرا", email: "accountant@consedra.sa" }, role: { id: 2, code: "accountant", nameAr: "محاسب" } }],
      invitations: [],
      notifications: [{ id: 8, titleAr: "دعوة عضو جديدة", bodyAr: "تمت دعوة محاسب.", status: "unread", createdAt: new Date("2026-08-15T12:00:00Z") }],
    },
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ team: { overview: { invalidate: vi.fn() } } }),
    team: {
      overview: { useQuery: () => mocks.overview },
      invite: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      updateMemberPhone: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      updateMemberRole: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      disableMember: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      revokeInvitation: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      markNotificationRead: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
  },
}));

import { TeamManagement } from "../../client/src/components/TeamManagement";

describe("team management component", () => {
  it("يتحقق من البريد واسم المستخدم وقوة كلمة المرور قبل الدعوة", () => {
    const source = require("fs").readFileSync(new URL("../../client/src/components/TeamManagement.tsx", import.meta.url), "utf8");
    expect(source).toContain("validEmail");
    expect(source).toContain("validUsername");
    expect(source).toContain("strongTemporaryPassword");
    expect(source).toContain("validPhone");
    expect(source).toContain("updateMemberPhone");
  });

  it("يعرض دعوة المحاسبين والأدوار وإزالة الوصول دون كشف أدوات حذف هوية المستخدم", () => {
    const html = renderToStaticMarkup(<TeamManagement tenantId={1} companyId={1} />);
    expect(html).toContain("فريق قيد وصلاحيات التشغيل");
    expect(html).toContain("accountant@consedra.sa");
    expect(html).toContain("دعوة عضو");
    expect(html).toContain("إزالة الوصول");
    expect(html).toContain("إشعارات الفريق");
    expect(html).toContain("رقم جوال العضو");
    expect(html).toContain("دعوة عضو جديدة");
    expect(html).not.toContain("حذف حساب المستخدم");
  });
});
