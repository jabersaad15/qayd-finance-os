import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { deriveAccountantDashboardState, filterAccountantDashboardSnapshot, validateAccountantDateRange } from "../../../shared/accountantDashboardState";
import { exportAccountantReportToExcel, exportAccountantReportToPdf } from "@/lib/accountantReportExport";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Landmark, Loader2, ReceiptText, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

const formatMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(value);

export function AccountantDashboard({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const [, navigate] = useLocation(); const input = useMemo(() => ({ tenantId: tenantId ?? 0, companyId: companyId ?? 0 }), [tenantId, companyId]); const enabled = Boolean(tenantId && companyId);
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const dateRange = useMemo(() => ({ startDate: startDate || undefined, endDate: endDate || undefined }), [startDate, endDate]);
  const dateError = validateAccountantDateRange(dateRange);
  const balanceInput = useMemo(() => ({ ...input, startDate: dateError ? undefined : dateRange.startDate, endDate: dateError ? undefined : dateRange.endDate }), [input, dateError, dateRange]);
  const reportExportRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const purchases = trpc.purchases.listSupplierInvoices.useQuery(input, { enabled }); const compliance = trpc.compliance.dashboard.useQuery(input, { enabled }); const vat = trpc.compliance.vatReturnWorkspace.useQuery(input, { enabled }); const balance = trpc.operations.trialBalance.useQuery(balanceInput, { enabled });
  if (!enabled || purchases.isLoading || compliance.isLoading || vat.isLoading || balance.isLoading) return <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-7"><Loader2 className="h-5 w-5 animate-spin text-[#0b3d3a]" /></CardContent></Card>;
  const queryError = purchases.error ?? compliance.error ?? vat.error ?? balance.error;
  if (queryError) return <Card className="border border-[#f2d5d0] shadow-sm rounded-2xl"><CardContent className="flex flex-col items-start gap-3 p-7"><AlertTriangle className="h-6 w-6 text-[#a94b3d]" /><div><p className="font-semibold text-[#7e352b]">تعذر تحميل لوحة المحاسب</p><p className="mt-1 text-sm leading-6 text-[#765953]">{queryError.message} لم تُعرض قيم صفرية بديلة حتى لا تُفهم كمؤشرات مالية فعلية.</p></div><Button variant="outline" onClick={() => void Promise.all([purchases.refetch(), compliance.refetch(), vat.refetch(), balance.refetch()])}>إعادة المحاولة</Button></CardContent></Card>;
  const filteredSnapshot = filterAccountantDashboardSnapshot({ purchases: purchases.data, compliance: compliance.data, vat: vat.data, balance: balance.data }, dateRange);
  const dashboardState = deriveAccountantDashboardState(filteredSnapshot);
  if (!dashboardState.hasOperationalData) return <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="flex flex-col items-start gap-3 p-7"><ClipboardList className="h-6 w-6 text-[#54736a]" /><div><p className="font-semibold text-[#2b4338]">لا توجد بيانات تشغيلية بعد</p><p className="mt-1 text-sm leading-6 text-[#68776f]">ستظهر مهام المحاسب بعد إعداد فترة VAT أو إدخال مورد أو فاتورة أو قيد مرحّل. لا تعني هذه الحالة وجود أرصدة بقيمة صفر.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate("/operations")}>بدء عمليات الموردين</Button><Button variant="outline" onClick={() => navigate("/tax")}>إعداد VAT</Button></div></CardContent></Card>;
  const { pendingSupplier, draftSupplier, preparedVat, reviewedVat, debit, credit, balanced, reviewCount, queuedCompliance } = dashboardState;
  const runExport = async (kind: "pdf" | "xlsx") => {
    setExporting(kind);
    setExportError(null);
    if (dateError) { setExportError(dateError); setExporting(null); return; }
    try {
      if (kind === "xlsx") exportAccountantReportToExcel(dashboardState, undefined, dateRange);
      else if (reportExportRef.current) await exportAccountantReportToPdf(reportExportRef.current);
    } catch (error) {
      console.error("[AccountantDashboard] export failed", error);
      setExportError("تعذر إنشاء ملف التصدير. حاول مرة أخرى.");
    } finally {
      setExporting(null);
    }
  };
  const tasks = [
    { label: "فواتير المورد بانتظار المراجعة", value: pendingSupplier, path: "/operations", urgent: pendingSupplier > 0 },
    { label: "مسودات مورد غير مرسلة", value: draftSupplier, path: "/operations", urgent: false },
    { label: "ملفات VAT تحت المراجعة", value: preparedVat, path: "/tax", urgent: preparedVat > 0 },
    { label: "فحوص امتثال حرجة", value: reviewCount, path: "/tax", urgent: reviewCount > 0 },
  ];
  return <section ref={reportExportRef} id="accountant-report-export" className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe7e1] bg-white p-4 shadow-sm"><div><p className="text-base font-bold text-[#203d34]">تقرير لوحة المحاسب</p><p className="mt-1 text-xs text-[#748179]">شارك ملخص المؤشرات الحالية أو احفظه للاستخدام اللاحق.</p></div><div className="export-exclude basis-full flex flex-wrap items-center gap-3 text-sm"><label className="flex items-center gap-2">من <input aria-label="تاريخ بداية التقرير" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-[#dfe7e1] px-2 py-1.5 text-left" dir="ltr" /></label><label className="flex items-center gap-2">إلى <input aria-label="تاريخ نهاية التقرير" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-[#dfe7e1] px-2 py-1.5 text-left" dir="ltr" /></label>{dateError && <span className="text-[#9a3f33]">{dateError}</span>}</div><div className="export-exclude flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={Boolean(exporting) || Boolean(dateError)} onClick={() => void runExport("xlsx")}>{exporting === "xlsx" ? "جاري تجهيز Excel..." : "تصدير Excel"}</Button><Button type="button" className="bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={Boolean(exporting) || Boolean(dateError)} onClick={() => void runExport("pdf")}>{exporting === "pdf" ? "جاري تجهيز PDF..." : "تصدير PDF"}</Button></div>{exportError && <p className="export-exclude basis-full text-sm text-[#9a3f33]">{exportError}</p>}</div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<ReceiptText className="h-5 w-5" />} label="مراجعة الموردين" value={pendingSupplier} hint="بانتظار قرار المراجعة" tone="bg-[#fff2e5] text-[#9a5a17]" /><Metric icon={<ShieldCheck className="h-5 w-5" />} label="VAT مراجع" value={reviewedVat} hint="ملفات مراجعة غير مودعة" tone="bg-[#e8f4ec] text-[#21663a]" /><Metric icon={<ClipboardList className="h-5 w-5" />} label="طابور الامتثال" value={queuedCompliance} hint="طلبات قيد المعالجة" tone="bg-[#edf2fa] text-[#385f98]" /><Metric icon={<Landmark className="h-5 w-5" />} label="ميزان المراجعة" value={balanced ? "متوازن" : "يتطلب مراجعة"} hint={balanced ? "المدين يساوي الدائن" : `فرق ${formatMoney(Math.abs(debit - credit))}`} tone={balanced ? "bg-[#e8f4ec] text-[#21663a]" : "bg-[#fff0ee] text-[#9a3f33]"} /></section>
  <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><Card className="border-0 shadow-sm rounded-2xl"><CardHeader><CardTitle className="text-base">مهام المحاسب التشغيلية</CardTitle><p className="text-sm text-muted-foreground">قائمة ذات أولوية مبنية على حالات النظام الحالية، وليست بديلًا عن إجراءات الاعتماد المعتمدة.</p></CardHeader><CardContent className="space-y-3">{tasks.map((task) => <button type="button" key={task.label} onClick={() => navigate(task.path)} className="flex w-full items-center justify-between rounded-xl border border-[#dfe7e1] bg-[#fbfdfb] p-4 text-right transition-colors hover:bg-[#f1f6f2]"><div className="flex items-center gap-3">{task.urgent ? <AlertTriangle className="h-5 w-5 text-[#a85d15]" /> : <CheckCircle2 className="h-5 w-5 text-[#3d7650]" />}<div><p className="font-medium text-[#2a4035]">{task.label}</p><p className="mt-1 text-xs text-[#748179]">افتح الوحدة لاتخاذ الإجراء المصرح به.</p></div></div><div className="flex items-center gap-3"><Badge variant="outline" dir="ltr">{task.value}</Badge><ArrowLeft className="h-4 w-4 text-[#6e7c74]" /></div></button>)}</CardContent></Card>
  <Card className="border-0 shadow-sm rounded-2xl"><CardHeader><CardTitle className="text-base">اختصارات اليوم</CardTitle></CardHeader><CardContent className="space-y-3"><Shortcut label="فاتورة مورد جديدة" description="إنشاء مسودة ثم إرسالها للمراجعة." action={() => navigate("/operations")} /><Shortcut label="تحضير إقرار VAT" description="تجميع المخرجات والمدخلات ضمن فترة ضريبية." action={() => navigate("/tax")} /><Shortcut label="تتبع حساب محاسبي" description="فتح القوائم ثم قيود الأستاذ العام المصدرية." action={() => navigate("/accounting")} /><Button variant="outline" className="w-full" onClick={() => navigate("/audit")}>مراجعة الإقفال والطلبات</Button></CardContent></Card></section></section>;
}

function Metric({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: number | string; hint: string; tone: string }) { return <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</div><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-[#203d34]" dir={typeof value === "number" ? "ltr" : undefined}>{value}</p><p className="mt-1 text-xs text-[#78857e]">{hint}</p></CardContent></Card>; }
function Shortcut({ label, description, action }: { label: string; description: string; action: () => void }) { return <button type="button" className="w-full rounded-xl border border-[#e1e8e2] p-3 text-right hover:bg-[#f6faf7]" onClick={action}><p className="font-medium text-sm text-[#2a4035]">{label}</p><p className="mt-1 text-xs text-[#75817a]">{description}</p></button>; }
