import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  board: { isLoading: false, isFetching: false, error: null as Error | null, data: { totalInvoiced: "1725.000000", totalPaid: "500.000000", remainingBalance: "1225.000000", overdue: [{ id: 1 }], upcoming: [{ id: 2 }], invoices: [{ id: 1, invoiceNumber: "INV-2026-001", customerName: "شركة اختبار", salesOwnerName: "موظف المبيعات", outstanding: "1225.000000", dueDate: new Date("2026-08-10"), paymentStatus: "overdue", settlementStatus: "partially_paid", grandTotal: "1725.000000", paidTotal: "500.000000", issueDate: new Date("2026-08-01"), status: "partially_paid", daysFromDue: -6 }] }, refetch: vi.fn() },
  assignees: { data: [{ userId: 7, name: "موظف المبيعات", email: "sales@example.com" }], isLoading: false },
  followUps: { data: [], isLoading: false, refetch: vi.fn() },
  mutation: { isPending: false, mutate: vi.fn() },
}));

vi.mock("@/lib/trpc", () => ({ trpc: { sales: { collectionsBoard: { useQuery: () => mocks.board }, listSalesAssignees: { useQuery: () => mocks.assignees }, listCollectionFollowUps: { useQuery: () => mocks.followUps }, logCollectionFollowUp: { useMutation: () => mocks.mutation }, sendOverduePaymentReminder: { useMutation: () => mocks.mutation } } } }));

import { CollectionsBoard } from "../../client/src/components/CollectionsBoard";

describe("collections board component", () => {
  it("يعرض المؤشرات والفاتورة المتأخرة ومسؤول المتابعة", () => {
    const html = renderToStaticMarkup(<CollectionsBoard tenantId={1} companyId={1} />);
    expect(html).toContain("لوحة التحصيلات الموحدة");
    expect(html).toContain("الرصيد المتبقي للتحصيل");
    expect(html).toContain("INV-2026-001");
    expect(html).toContain("فواتير متأخرة");
    expect(html).toContain("موظف المبيعات");
    expect(html).toContain("ابحث برقم الفاتورة أو اسم العميل");
    expect(html).toContain("حالة الدفع");
  });

  it("يعرض حالة الفراغ دون تحويلها إلى مؤشرات مالية وهمية", () => {
    mocks.board.data = { totalInvoiced: "0.000000", totalPaid: "0.000000", remainingBalance: "0.000000", overdue: [], upcoming: [], invoices: [] } as typeof mocks.board.data;
    const html = renderToStaticMarkup(<CollectionsBoard tenantId={1} companyId={1} />);
    expect(html).toContain("لا توجد فواتير تطابق الفلاتر الحالية");
  });
});
