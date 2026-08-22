import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { query, mutation } = vi.hoisted(() => ({ query: (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() }), mutation: () => ({ isPending: false, mutate: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({}), sales: {
  listCustomers: { useQuery: () => query([{ id: 1, name: "شركة تجريبية" }]) },
  listSalesAssignees: { useQuery: () => query([{ userId: 7, name: "ممثل المبيعات", email: "rep@example.com" }]) },
  listSalesAttributions: { useQuery: () => query([]) }, listSalesVisits: { useQuery: () => query([]) }, salesCommissionBoard: { useQuery: () => query({ totals: { pending: "0", approved: "0", paid: "0" }, entries: [] }) },
  recordCustomerAttribution: { useMutation: mutation }, recordSalesVisit: { useMutation: mutation }, createCommissionRule: { useMutation: mutation },
} } }));

import { SalesRepOwnershipBoard } from "../../client/src/components/SalesRepOwnershipBoard";

describe("sales representative ownership board", () => {
  it("يعرض ملكية الاستحواذ والزيارات والعمولات", () => {
    const html = renderToStaticMarkup(<SalesRepOwnershipBoard tenantId={1} companyId={1} />);
    expect(html).toContain("ملكية الاستحواذ وسجل ممثل المبيعات");
    expect(html).toContain("تسجيل شركة أو طالب خدمة باسم ممثل المبيعات");
    expect(html).toContain("تسجيل زيارة أو تواصل");
    expect(html).toContain("العمولات");
    expect(html).toContain("ممثل المبيعات");
  });
});
