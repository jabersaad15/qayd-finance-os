import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  convert: { isPending: false, mutate: vi.fn() },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ sales: { listQuotations: { invalidate: vi.fn() }, listInvoices: { invalidate: vi.fn() } } }),
    sales: {
      listQuotations: { useQuery: () => ({ data: [{ id: 7, quoteNumber: "Q-2026-002", grandTotal: "1150.000000", status: "accepted" }] }) },
      listInvoices: { useQuery: () => ({ data: [] }) },
      convertQuotationToDraft: { useMutation: () => mocks.convert },
    },
  },
}));

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: any }) => <a href={href} {...props}>{children}</a>, useLocation: () => ["/sales", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OfficialDocumentsIndex } from "../../client/src/components/OfficialDocumentsIndex";

describe("official documents index", () => {
  it("يعرض زر التحويل للعرض المقبول مع دور إصدار الفواتير", () => {
    const html = renderToStaticMarkup(<OfficialDocumentsIndex tenantId={1} companyId={1} roleCode="finance_manager" />);
    expect(html).toContain("تحويل إلى فاتورة");
    expect(html).toContain("Q-2026-002");
    expect(html).not.toContain("رقم الفاتورة الجديدة");
  });

  it("يعرض زر التحويل لمشرف المبيعات", () => {
    const html = renderToStaticMarkup(<OfficialDocumentsIndex tenantId={1} companyId={1} roleCode="sales" />);
    expect(html).toContain("تحويل إلى فاتورة");
  });

  it("لا يعرض زر التحويل دون دور إصدار الفواتير", () => {
    const html = renderToStaticMarkup(<OfficialDocumentsIndex tenantId={1} companyId={1} roleCode="sales_rep" />);
    expect(html).not.toContain("تحويل إلى فاتورة");
  });
});
