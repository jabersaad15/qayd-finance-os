import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountant: { purchases: { isLoading: false, error: null as Error | null, data: [] as any[], refetch: vi.fn() }, compliance: { isLoading: false, error: null as Error | null, data: { submissions: [], checks: [], preparations: [], reviewCount: 0, queuedCount: 0 }, refetch: vi.fn() }, vat: { isLoading: false, error: null as Error | null, data: { periods: [], zakatDocuments: [], preparations: [] }, refetch: vi.fn() }, balance: { isLoading: false, error: null as Error | null, data: [] as any[], refetch: vi.fn() } },
  reports: { trial: { isLoading: false, error: null as Error | null, data: [] as any[] }, ledger: { isLoading: false, error: null as Error | null, data: [] as any[] } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: { purchases: { listSupplierInvoices: { useQuery: () => mocks.accountant.purchases } }, compliance: { dashboard: { useQuery: () => mocks.accountant.compliance }, vatReturnWorkspace: { useQuery: () => mocks.accountant.vat } }, operations: { trialBalance: { useQuery: (_input: unknown, options: { enabled: boolean }) => options.enabled ? (mocks.reports.trial as any) : { ...mocks.reports.trial, data: [] } }, ledger: { useQuery: () => mocks.reports.ledger } } } }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));

import { AccountantDashboard } from "../../client/src/components/AccountantDashboard";
import { DetailedFinancialReports } from "../../client/src/components/DetailedFinancialReports";

describe("protected dashboard component rendering", () => {
  beforeEach(() => {
    mocks.accountant.purchases = { isLoading: false, error: null, data: [], refetch: vi.fn() };
    mocks.accountant.compliance = { isLoading: false, error: null, data: { submissions: [], checks: [], preparations: [], reviewCount: 0, queuedCount: 0 }, refetch: vi.fn() };
    mocks.accountant.vat = { isLoading: false, error: null, data: { periods: [], zakatDocuments: [], preparations: [] }, refetch: vi.fn() };
    mocks.accountant.balance = { isLoading: false, error: null, data: [], refetch: vi.fn() };
    mocks.reports.trial = { isLoading: false, error: null, data: [] };
  });

  it("يعرض حالة الفراغ للوحة المحاسب ولا يعرض أرقاماً صفرية مضللة", () => {
    const html = renderToStaticMarkup(<AccountantDashboard tenantId={1} companyId={1} />);
    expect(html).toContain("لا توجد بيانات تشغيلية بعد");
    expect(html).not.toContain("ميزان المراجعة");
  });

  it("يعرض حالة الخطأ والفراغ للتقارير واللوحة بوضوح", () => {
    const emptyReportsHtml = renderToStaticMarkup(<DetailedFinancialReports tenantId={1} companyId={1} />);
    expect(emptyReportsHtml).toContain("لا توجد أرصدة مرحلة ضمن هذا التصنيف.");
    mocks.accountant.purchases.error = new Error("فشل الموردين");
    expect(renderToStaticMarkup(<AccountantDashboard tenantId={1} companyId={1} />)).toContain("تعذر تحميل لوحة المحاسب");
    mocks.accountant.purchases.error = null;
    mocks.reports.trial.error = new Error("فشل ميزان المراجعة");
    expect(renderToStaticMarkup(<DetailedFinancialReports tenantId={1} companyId={1} />)).toContain("تعذر تحميل التقارير المالية");
  });

  it("يعرض الاختصارات والمؤشرات من البيانات الفعلية", () => {
    mocks.accountant.purchases.data = [{ invoice: { status: "pending_review" } }];
    mocks.accountant.compliance.data = { submissions: [{}], checks: [], preparations: [], reviewCount: 1, queuedCount: 2 } as any;
    mocks.accountant.balance.data = [{ debit: "100", credit: "100" }];
    const accountantHtml = renderToStaticMarkup(<AccountantDashboard tenantId={1} companyId={1} />);
    expect(accountantHtml).toContain("فاتورة مورد جديدة");
    expect(accountantHtml).toContain("تصدير Excel");
    expect(accountantHtml).toContain("تصدير PDF");
    expect(accountantHtml).toContain("تاريخ بداية التقرير");
    expect(accountantHtml).toContain("تاريخ نهاية التقرير");
    expect(accountantHtml).toContain("متوازن");
    mocks.reports.trial.data = [{ id: 1, code: "4000", nameAr: "إيرادات الخدمات", accountType: "revenue", debit: "0", credit: "1000" }];
    const reportsHtml = renderToStaticMarkup(<DetailedFinancialReports tenantId={1} companyId={1} />);
    expect(reportsHtml).toContain("إيرادات الخدمات");
    expect(reportsHtml).toContain("قائمة الدخل التفصيلية");
  });
});
