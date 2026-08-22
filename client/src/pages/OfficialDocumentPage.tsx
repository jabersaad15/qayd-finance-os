import { OfficialDocumentTemplate } from "@/components/OfficialDocumentTemplate";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { mapInvoiceToOfficialDocument, mapQuotationToOfficialDocument } from "../../../shared/officialDocumentPayload";
import { ArrowRight, Loader2, Printer } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useState } from "react";

type DocumentKind = "quotation" | "invoice";

export default function OfficialDocumentPage() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/print/:type/:id");
  const type: DocumentKind = params?.type === "invoice" ? "invoice" : "quotation";
  const documentId = Number(params?.id ?? 0);
  const [taxQrReady, setTaxQrReady] = useState(type !== "invoice");
  const workspaces = trpc.finance.listMyWorkspaces.useQuery(undefined, { enabled: isAuthenticated });
  const workspace = workspaces.data?.[0];
  const input = { tenantId: workspace?.tenant.id ?? 0, companyId: workspace?.company?.id ?? 0 };
  const quote = trpc.sales.getQuotationDocument.useQuery({ ...input, quotationId: documentId }, { enabled: Boolean(documentId && workspace && type === "quotation") });
  const invoice = trpc.sales.getInvoiceDocument.useQuery({ ...input, invoiceId: documentId }, { enabled: Boolean(documentId && workspace && type === "invoice") });
  const branding = trpc.finance.getCompanyBranding.useQuery(input, { enabled: Boolean(workspace) });
  const isLoading = workspaces.isLoading || quote.isLoading || invoice.isLoading || branding.isLoading;
  const document = type === "quotation" && quote.data ? mapQuotationToOfficialDocument(quote.data) : type === "invoice" && invoice.data ? mapInvoiceToOfficialDocument(invoice.data) : null;

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-[#eef3f8]"><Loader2 className="h-6 w-6 animate-spin text-[#182a46]" /></div>;
  if (!workspace || !document) return <div className="grid min-h-screen place-items-center bg-[#eef3f8] p-6 text-center" dir="rtl"><div><p className="text-lg font-bold text-[#182a46]">تعذر العثور على المستند</p><p className="mt-2 text-sm text-[#5c6470]">تحقق من رقم المستند وصلاحية الوصول إلى مساحة العمل.</p><Link href="/sales" className="mt-5 inline-flex text-sm font-medium text-[#2f61a0]">العودة إلى المبيعات</Link></div></div>;

  return <main className="min-h-screen bg-[#eef3f8] py-5 print:bg-white" dir="rtl">
    <div className="print-hidden mx-auto mb-5 flex w-full max-w-[210mm] items-center justify-between gap-3 px-4 sm:px-0">
      <Link href="/sales" className="inline-flex items-center gap-2 text-sm font-medium text-[#284768]"><ArrowRight className="h-4 w-4" />العودة للمبيعات</Link>
      <div className="flex flex-col items-end gap-1"><Button className="bg-[#182a46] hover:bg-[#10223f]" disabled={type === "invoice" && !taxQrReady} onClick={() => window.print()}><Printer className="ml-2 h-4 w-4" />{type === "invoice" && !taxQrReady ? "جارٍ تجهيز QR الضريبي…" : "طباعة المستند"}</Button>{type === "invoice" && !taxQrReady ? <span className="text-xs text-[#5c6470]">تتاح الطباعة فور ظهور رمز QR الضريبي.</span> : null}</div>
    </div>
    <OfficialDocumentTemplate
      type={type}
      documentNumber={document.documentNumber}
      issueDate={document.issueDate}
      expiryDate={document.expiryDate}
      customer={document.customer}
      seller={document.seller}
      scopeOfWork={document.scopeOfWork}
      paymentTerms={document.paymentTerms}
      lines={document.lines}
      subtotal={document.subtotal}
      taxTotal={document.taxTotal}
      grandTotal={document.grandTotal}
      status={document.status}
      branding={branding.data}
      onTaxQrReady={setTaxQrReady}
    />
  </main>;
}
