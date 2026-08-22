import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  report: { data: { totalOpportunities: 4, totalExpectedValue: "240000.00", totalWeightedValue: "132000.00", historyCoverage: true, transitions: [{ fromStage: "new_lead", fromLabel: "عميل محتمل", toStage: "qualified", toLabel: "مؤهل", entered: 10, advanced: 7, conversionRate: 70 }, { fromStage: "qualified", fromLabel: "مؤهل", toStage: "discovery", toLabel: "اكتشاف الاحتياج", entered: 7, advanced: 5, conversionRate: 71.43 }], reps: [{ userId: 7, name: "مسؤول المبيعات", email: "sales@example.com", opportunities: 4, open: 2, won: 2, lost: 0, expectedValue: "240000.00", weightedValue: "132000.00", activities: 8, completedActivities: 6, overdueActivities: 1, winRate: 50, activityCompletionRate: 75 }] }, refetch: vi.fn(), isLoading: false, error: null },
  assignees: { data: [{ userId: 7, name: "مسؤول المبيعات", email: "sales@example.com" }] },
  weeklyNotes: { data: [], refetch: vi.fn() },
}));

vi.mock("@/lib/trpc", () => ({ trpc: { sales: { salesPerformanceReport: { useQuery: () => mocks.report }, listSalesAssignees: { useQuery: () => mocks.assignees } }, executive: { listSalesWeeklyRepNotes: { useQuery: () => mocks.weeklyNotes }, saveSalesWeeklyRepNote: { useMutation: () => ({ mutateAsync: vi.fn() }) } } } }));

import { SalesPerformanceReports } from "../../client/src/components/SalesPerformanceReports";
import { buildSalesPerformanceSummaryRows } from "../../client/src/lib/salesPerformanceExport";

describe("sales performance reports component", () => {
  it("يعرض مؤشرات التقرير وقمع التحويل وترتيب ممثلي المبيعات", () => {
    const html = renderToStaticMarkup(<SalesPerformanceReports tenantId={1} companyId={1} />);
    expect(html).toContain("التقرير الأسبوعي المجمع للمبيعات");
    expect(html).toContain("قمع التحويل بين المراحل");
    expect(html).toContain("مسؤول المبيعات");
    expect(html).toContain("70%");
    expect(html).toContain("القيمة المرجحة");
    expect(html).toContain("من تاريخ");
    expect(html).toContain("الأسبوع السابق");
    expect(html).toContain("توجيه مهند");
    expect(html).toContain("المتابعات المتأخرة");
  });

  it("ينشئ صفوف ملخص منظمة للفترة والقيم", () => {
    const rows = buildSalesPerformanceSummaryRows(mocks.report.data, new Date("2026-08-16T00:00:00.000Z"), { startDate: "2026-01-01", endDate: "2026-08-16" });
    expect(rows).toContainEqual(["إجمالي الفرص", 4]);
    expect(rows).toContainEqual(["القيمة المرجحة (SAR)", "132000.00"]);
    expect(rows[2][1]).toContain("2026-01-01");
  });
});
