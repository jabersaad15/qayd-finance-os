import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, FileText, Loader2, Printer } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const formatAmount = (value: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(Number(value));

const invoiceIssueRoles = new Set(["company_admin", "super_admin", "cfo", "finance_manager", "sales"]);

export function OfficialDocumentsIndex({ tenantId, companyId, roleCode }: { tenantId?: number; companyId?: number; roleCode?: string }) {
  const enabled = Boolean(tenantId && companyId);
  const input = { tenantId: tenantId ?? 0, companyId: companyId ?? 0 };
  const [, navigate] = useLocation();
  const quotations = trpc.sales.listQuotations.useQuery(input, { enabled });
  const invoices = trpc.sales.listInvoices.useQuery(input, { enabled });
  const utils = trpc.useUtils();
  const convertQuotation = trpc.sales.convertQuotationToDraft.useMutation({
    onSuccess: async (result) => {
      toast.success(`تم تحويل العرض إلى الفاتورة ${result.invoiceNumber} كمسودة.`);
      await Promise.all([utils.sales.listQuotations.invalidate(input), utils.sales.listInvoices.invalidate(input)]);
      navigate(`/print/invoice/${result.invoiceId}`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (!enabled) return null;
  const hasDocuments = Boolean(quotations.data?.length || invoices.data?.length);
  return <Card className="mt-5 rounded-2xl border-0 shadow-sm"><CardHeader><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf0fb] text-[#182a46]"><FileText className="h-5 w-5" /></div><div><CardTitle className="text-base">المستندات الرسمية</CardTitle><p className="mt-1 text-sm text-muted-foreground">افتح عرض السعر أو الفاتورة الفعلية في قالب كونسيدرا الرسمي ثم اطبعها بمقاس A4.</p></div></div></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2">{hasDocuments ? <><section className="space-y-2"><p className="text-xs font-bold text-[#3c536c]">عروض الأسعار</p>{quotations.data?.length ? quotations.data.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce4ee] bg-[#fbfcfe] p-3"><div><p className="font-medium text-[#1d2b40]" dir="ltr">{item.quoteNumber}</p><p className="mt-1 text-xs text-[#607084]" dir="ltr">{formatAmount(item.grandTotal)} · {item.status === "converted" ? "محوّل إلى فاتورة" : item.status === "accepted" ? "مقبول من العميل" : item.status === "sent" ? "بانتظار موافقة العميل" : "غير متاح للتحويل"}</p></div><div className="flex flex-wrap items-center gap-2"><Link href={`/print/quotation/${item.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-[#bfcde0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#224674] hover:bg-[#eef3fb]"><Printer className="h-3.5 w-3.5" />طباعة</Link>{invoiceIssueRoles.has(roleCode ?? "") && <Button type="button" size="sm" variant="outline" disabled={item.status !== "accepted" || convertQuotation.isPending} title={item.status !== "accepted" ? "لا يمكن التحويل قبل موافقة العميل" : undefined} onClick={() => convertQuotation.mutate({ ...input, quotationId: item.id, issueDate: new Date().toISOString().slice(0, 10), invoiceType: "standard" })}>{convertQuotation.isPending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />}<ArrowLeftRight className="ml-1 h-3.5 w-3.5" />{item.status === "converted" ? "تم التحويل" : item.status === "accepted" ? "تحويل إلى فاتورة" : "بانتظار قبول العميل"}</Button>}</div></div>) : <p className="rounded-xl bg-[#f7f9fc] p-3 text-xs text-[#667487]">لا توجد عروض أسعار محفوظة.</p>}</section><section className="space-y-2"><p className="text-xs font-bold text-[#3c536c]">الفواتير</p>{invoices.data?.length ? invoices.data.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#dce4ee] bg-[#fbfcfe] p-3"><div><p className="font-medium text-[#1d2b40]" dir="ltr">{item.invoiceNumber}</p><p className="mt-1 text-xs text-[#607084]" dir="ltr">{formatAmount(item.grandTotal)}</p></div><Link href={`/print/invoice/${item.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-[#bfcde0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#224674] hover:bg-[#eef3fb]"><Printer className="h-3.5 w-3.5" />طباعة</Link></div>) : <p className="rounded-xl bg-[#f7f9fc] p-3 text-xs text-[#667487]">لا توجد فواتير محفوظة.</p>}</section></> : <p className="rounded-xl bg-[#f7f9fc] p-4 text-sm text-[#667487] lg:col-span-2">ستظهر هنا روابط الطباعة بعد حفظ عرض سعر أو إصدار فاتورة.</p>}</CardContent></Card>;
}
