import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { FileCheck2, Loader2, Plus, Trash2 } from "lucide-react";
import React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { documentSaveErrorMessage } from "../../../shared/documentSaveError";
import { isValidOnRequestPrice } from "../../../shared/salesPricing";

type DraftLine = { key: string; serviceId: string; quantity: string; unitPrice: string };
const makeLine = (): DraftLine => ({ key: crypto.randomUUID(), serviceId: "", quantity: "1", unitPrice: "" });

export function PriceOnRequestDocumentForm({ tenantId, companyId, mode = "both" }: { tenantId?: number; companyId?: number; mode?: "both" | "invoice" | "quotation" }) {
  const enabled = Boolean(tenantId && companyId);
  const input = { tenantId: tenantId ?? 0, companyId: companyId ?? 0 };
  const customers = trpc.sales.listCustomers.useQuery(input, { enabled });
  const services = trpc.sales.listServices.useQuery(input, { enabled });
  const utils = trpc.useUtils();
  const [kind, setKind] = useState<"quotation" | "invoice">(mode === "invoice" ? "invoice" : "quotation");
  const [customerId, setCustomerId] = useState("");
  const [customerContactId, setCustomerContactId] = useState("");
  const contacts = trpc.sales.listCustomerContacts.useQuery({ ...input, customerId: Number(customerId) || 0 }, { enabled: enabled && Boolean(customerId) });
  const [expiryDate, setExpiryDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([makeLine()]);
  const reset = () => { setLines([makeLine()]); setCustomerId(""); setCustomerContactId(""); setExpiryDate(""); setDueDate(""); setScopeOfWork(""); setPaymentTerms(""); };
  const createQuotation = trpc.sales.createQuotation.useMutation({ onSuccess: async (result) => { toast.success(`تم حفظ عرض السعر برقم ${result.quoteNumber}.`); reset(); await utils.sales.listQuotations.invalidate(input); }, onError: (error) => toast.error(documentSaveErrorMessage(error.message, "quotation")) });
  const issueInvoice = trpc.sales.createAndIssueInvoice.useMutation({ onSuccess: async (result) => { toast.success(`صدرت الفاتورة برقم ${result.invoiceNumber} وأنشئ القيد ${result.journalEntryId}.`); reset(); await utils.sales.listInvoices.invalidate(input); }, onError: (error) => toast.error(documentSaveErrorMessage(error.message, "invoice")) });
  const busy = createQuotation.isPending || issueInvoice.isPending;
  const updateLine = (key: string, field: keyof Omit<DraftLine, "key">, value: string) => setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  const valid = lines.length > 0 && lines.every((line) => Boolean(line.serviceId) && Number(line.quantity) > 0 && isValidOnRequestPrice(line.unitPrice));
  const dateLabel = kind === "quotation" ? "صلاحية العرض حتى" : "تاريخ استحقاق الفاتورة";
  const dateValue = kind === "quotation" ? expiryDate : dueDate;
  const setDateValue = kind === "quotation" ? setExpiryDate : setDueDate;

  const submit = () => {
    if (!customerId || !valid) return;
    const payloadLines = lines.map((line) => {
      const service = services.data?.find((item) => String(item.id) === line.serviceId);
      return { productServiceId: service!.id, description: service!.nameAr, quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: "0", taxRateBps: 1500 };
    });
    const base = { ...input, customerId: Number(customerId), customerContactId: customerContactId ? Number(customerContactId) : undefined, issueDate: new Date().toISOString().slice(0, 10), scopeOfWork: scopeOfWork.trim() || undefined, paymentTerms: paymentTerms.trim() || undefined, lines: payloadLines };
    if (kind === "quotation") createQuotation.mutate({ ...base, expiryDate: expiryDate || undefined });
    else issueInvoice.mutate({ ...base, invoiceType: "standard", dueDate: dueDate || undefined });
  };

  if (!enabled) return null;
  return <Card className="mt-5 rounded-2xl border border-[#c9d7ea] bg-[#fbfdff] shadow-sm">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#182a46]"><FileCheck2 className="h-5 w-5" />{mode === "invoice" ? "إنشاء فاتورة ضريبية" : "إنشاء عرض سعر أو فاتورة"}</CardTitle><p className="text-sm leading-6 text-[#536a82]">أضف أي عدد من خدمات شركتك وحدد السعر والكمية والنطاق والشروط لكل مستند. <strong>رقم المستند يُنشأ تلقائياً ومتسلسلاً عند الحفظ.</strong></p></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {mode === "both" ? <label className="text-sm font-medium text-[#44564d]">نوع المستند<select value={kind} onChange={(event) => setKind(event.target.value as "quotation" | "invoice")} className="mt-2 h-11 w-full rounded-md border border-[#cbd7e5] bg-white px-3 text-sm"><option value="quotation">عرض سعر</option><option value="invoice">فاتورة ضريبية</option></select></label> : <div className="flex items-end text-sm font-semibold text-[#182a46]">فاتورة ضريبية</div>}
        <label className="text-sm font-medium text-[#44564d]">العميل<select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setCustomerContactId(""); }} className="mt-2 h-11 w-full rounded-md border border-[#cbd7e5] bg-white px-3 text-sm"><option value="">اختر العميل</option>{customers.data?.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="text-sm font-medium text-[#44564d]">جهة الاتصال<select value={customerContactId} disabled={!customerId || contacts.isLoading} onChange={(event) => setCustomerContactId(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#cbd7e5] bg-white px-3 text-sm"><option value="">الجهة الأساسية أو بدون تحديد</option>{contacts.data?.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.jobTitle ? ` — ${contact.jobTitle}` : ""}</option>)}</select></label>
        <label className="text-sm font-medium text-[#44564d]">{dateLabel}<Input type="date" lang="en-CA" value={dateValue} onChange={(event) => setDateValue(event.target.value)} className="mt-2 text-left" dir="ltr" /></label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#d9e3ef]"><div className="min-w-[720px]">
        <div className="grid grid-cols-[1.8fr_0.55fr_0.8fr_0.55fr] gap-3 bg-[#182a46] px-3 py-2 text-xs font-medium text-white"><span>الخدمة</span><span>الكمية</span><span>السعر المتفق عليه</span><span className="text-center">إجراء</span></div>
        {lines.map((line) => <div className="grid grid-cols-[1.8fr_0.55fr_0.8fr_0.55fr] items-end gap-3 border-t border-[#e3eaf2] bg-white px-3 py-3" key={line.key}><select value={line.serviceId} onChange={(event) => updateLine(line.key, "serviceId", event.target.value)} className="h-10 rounded-md border border-[#cbd7e5] bg-white px-2 text-sm"><option value="">اختر الخدمة</option>{services.data?.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}</select><Input value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} dir="ltr" inputMode="decimal" /><Input value={line.unitPrice} onChange={(event) => updateLine(line.key, "unitPrice", event.target.value)} dir="ltr" inputMode="decimal" placeholder="0.00" /><Button type="button" size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} aria-label="حذف البند"><Trash2 className="h-4 w-4 text-[#a94d41]" /></Button></div>)}
      </div></div>
      <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setLines((current) => [...current, makeLine()])}><Plus className="ml-2 h-4 w-4" />إضافة خدمة أخرى</Button>
      <div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-medium text-[#44564d]">نطاق العمل<textarea value={scopeOfWork} onChange={(event) => setScopeOfWork(event.target.value)} maxLength={4000} rows={4} className="mt-2 w-full resize-y rounded-md border border-[#cbd7e5] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#182a46]" placeholder="صف المخرجات ونطاق التنفيذ المتفق عليه." /></label><label className="text-sm font-medium text-[#44564d]">شروط السداد والتنفيذ<textarea value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} maxLength={4000} rows={4} className="mt-2 w-full resize-y rounded-md border border-[#cbd7e5] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#182a46]" placeholder="مثال: 50% عند التعميد و50% عند التسليم." /></label></div>
      <Button disabled={!customerId || !valid || busy} onClick={submit} className="w-full bg-[#182a46] hover:bg-[#10223f]">{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{kind === "quotation" ? "حفظ عرض السعر وترقيمه تلقائياً" : "إصدار الفاتورة وترقيمها تلقائياً"}</Button>
    </CardContent>
  </Card>;
}
