import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  summary: { data: { totalOpportunities: 2, openOpportunities: 1, weightedPipeline: "75000.00", totalPipeline: "100000.00", wonValue: "25000.00", overdueActivities: 1, todayActivities: 1, byStage: { new_lead: 1, proposal: 1 } }, refetch: vi.fn(), isLoading: false },
  opportunities: { data: [{ opportunity: { id: 11, title: "عقد تشغيل مالي", stage: "proposal", probability: 75, expectedValue: "100000.000000", expectedCloseDate: new Date("2026-09-15"), serviceInterest: "التشغيل المالي", nextAction: "إرسال العرض الفني", nextActionDate: new Date("2026-08-20") }, customerName: "شركة سعودية", ownerName: "مسؤول المبيعات", ownerEmail: "sales@example.com" }], refetch: vi.fn(), isLoading: false, error: null },
  activities: { data: [{ activity: { id: 3, activityType: "call", subject: "متابعة العرض", dueDate: new Date("2026-08-16"), status: "open" }, customerName: "شركة سعودية", ownerName: "مسؤول المبيعات" }], refetch: vi.fn(), isLoading: false },
  customers: { data: [{ id: 1, name: "شركة سعودية" }] },
  assignees: { data: [{ userId: 7, name: "مسؤول المبيعات", email: "sales@example.com" }] },
  mutation: { isPending: false, mutate: vi.fn() },
}));

vi.mock("@/lib/trpc", () => ({ trpc: { sales: { salesPipelineSummary: { useQuery: () => mocks.summary }, listSalesOpportunities: { useQuery: () => mocks.opportunities }, listSalesActivities: { useQuery: () => mocks.activities }, listCustomers: { useQuery: () => mocks.customers }, listSalesAssignees: { useQuery: () => mocks.assignees }, updateSalesOpportunity: { useMutation: () => mocks.mutation }, createSalesOpportunity: { useMutation: () => mocks.mutation }, createSalesActivity: { useMutation: () => mocks.mutation }, completeSalesActivity: { useMutation: () => mocks.mutation } } } }));

import { SalesCRMBoard } from "../../client/src/components/SalesCRMBoard";

describe("sales CRM board component", () => {
  it("يعرض مؤشرات خط المبيعات والفرصة والمتابعة", () => {
    const html = renderToStaticMarkup(<SalesCRMBoard tenantId={1} companyId={1} />);
    expect(html).toContain("لوحة CRM للمبيعات");
    expect(html).toContain("الفرص المفتوحة");
    expect(html).toContain("عقد تشغيل مالي");
    expect(html).toContain("شركة سعودية");
    expect(html).toContain("متابعة العرض");
    expect(html).toContain("ابحث عن فرصة أو عميل");
  });
});
