import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  quotation: { isPending: false, mutate: vi.fn() },
  invoice: { isPending: false, mutate: vi.fn() },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ sales: { listQuotations: { invalidate: vi.fn() }, listInvoices: { invalidate: vi.fn() } } }),
    sales: {
      listCustomers: { useQuery: () => ({ data: [{ id: 1, name: "شركة المعرفة" }] }) },
      listServices: { useQuery: () => ({ data: [{ id: 2, nameAr: "أتمتة الإجراءات" }] }) },
      listCustomerContacts: { useQuery: () => ({ data: [{ id: 3, name: "مدير العميل", jobTitle: "المدير المالي" }] }) },
      createQuotation: { useMutation: () => mocks.quotation },
      createAndIssueInvoice: { useMutation: () => mocks.invoice },
    },
  },
}));

import { PriceOnRequestDocumentForm } from "../../client/src/components/PriceOnRequestDocumentForm";

describe("price on request document form", () => {
  it("يعرض حقل تاريخ ISO متوافقاً مع الهاتف ولا يكشف تفاصيل قاعدة البيانات", () => {
    const html = renderToStaticMarkup(<PriceOnRequestDocumentForm tenantId={1} companyId={1} />);
    expect(html).toContain('type="date"');
    expect(html).toContain('lang="en-CA"');
    expect(html).toContain("إضافة خدمة أخرى");
    expect(html).not.toContain("insert into");
  });
});
