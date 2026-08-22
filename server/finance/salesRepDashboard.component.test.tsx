import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { sales: {
  listSalesAssignees: { useQuery: () => query([{ userId: 7, name: "ممثل المبيعات", email: "rep@example.com" }]) },
  salesRepDashboard: { useQuery: () => query({ visits: [], weeklyActivity: [{ date: "2026-08-17", label: "الاثنين", visits: 3, activities: 2 }], metrics: { fieldVisits: 3, completedActivities: 2, opportunities: 4, wonOpportunities: 1, winRate: 25, weightedPipeline: "12000.000000", pendingCommission: "500.000000", paidCommission: "250.000000", totalVisits: 3, openActivities: 1 } }) },
} } }));
vi.mock("@/components/Map", () => ({ MapView: () => <div data-testid="map-view">map</div> }));

import { SalesRepDashboard } from "../../client/src/components/SalesRepDashboard";

describe("sales representative dashboard", () => {
  it("يعرض الخريطة ومؤشرات الأداء والنشاط الأسبوعي", () => {
    const html = renderToStaticMarkup(<SalesRepDashboard tenantId={1} companyId={1} />);
    expect(html).toContain("لوحة تحكم ممثل المبيعات");
    expect(html).toContain("خريطة الزيارات الميدانية");
    expect(html).toContain("النشاط الأسبوعي");
    expect(html).toContain("نسبة الفوز");
    expect(html).toContain("ممثل المبيعات");
  });
});
