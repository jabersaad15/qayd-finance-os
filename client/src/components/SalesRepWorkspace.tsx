import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, CircleDollarSign, FileText, ListTodo, Plus, Send, Target, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const stageLabels: Record<string, string> = {
  new_lead: "عميل محتمل",
  qualified: "مؤهل",
  discovery: "اجتماع / اكتشاف",
  proposal: "عرض سعر",
  negotiation: "تفاوض",
  won: "مغلقة – فوز",
  lost: "مغلقة – خسارة",
  on_hold: "مؤجلة",
};

const money = (value: string | number | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(Number(value ?? 0));
const today = () => new Date().toISOString().slice(0, 10);

export function SalesRepWorkspace({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const enabled = Boolean(tenantId && companyId);
  const base = useMemo(() => ({ tenantId: tenantId ?? 0, companyId: companyId ?? 0 }), [tenantId, companyId]);
  const me = trpc.auth.me.useQuery(undefined, { enabled });
  const customers = trpc.sales.listCustomers.useQuery(base, { enabled });
  const opportunities = trpc.sales.listSalesOpportunities.useQuery({ ...base, stage: "all" }, { enabled });
  const activities = trpc.sales.listSalesActivities.useQuery({ ...base, status: "all" }, { enabled });
  const quotations = trpc.sales.listQuotations.useQuery(base, { enabled });
  const dashboard = trpc.sales.salesRepDashboard.useQuery({ ...base, salesRepUserId: me.data?.id ?? 0 }, { enabled: enabled && Boolean(me.data?.id) });
  const utils = trpc.useUtils();
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showQuotationForm, setShowQuotationForm] = useState(false);
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [expectedValue, setExpectedValue] = useState("0.000000");
  const [serviceInterest, setServiceInterest] = useState("");
  const [activitySubject, setActivitySubject] = useState("");
  const [activityCustomerId, setActivityCustomerId] = useState("");
  const [activityDueDate, setActivityDueDate] = useState(today());
  const [activityNotes, setActivityNotes] = useState("");
  const createOpportunity = trpc.sales.createSalesOpportunity.useMutation({
    onSuccess: async () => { toast.success("تم إنشاء الفرصة ضمن مساحتك."); setTitle(""); setCustomerId(""); setExpectedValue("0.000000"); setServiceInterest(""); setShowOpportunityForm(false); await Promise.all([opportunities.refetch(), dashboard.refetch()]); },
    onError: (error) => toast.error(error.message),
  });
  const createActivity = trpc.sales.createSalesActivity.useMutation({
    onSuccess: async () => { toast.success("تمت إضافة المتابعة."); setActivitySubject(""); setActivityNotes(""); setShowActivityForm(false); await Promise.all([activities.refetch(), dashboard.refetch()]); },
    onError: (error) => toast.error(error.message),
  });
  const rows = opportunities.data ?? [];
  const activityRows = activities.data ?? [];
  const metrics = dashboard.data?.metrics;
  const open = rows.filter((row) => !["won", "lost"].includes(row.opportunity.stage));
  const proposals = rows.filter((row) => row.opportunity.stage === "proposal");
  const wonThisMonth = rows.filter((row) => row.opportunity.stage === "won" && new Date(row.opportunity.updatedAt).getMonth() === new Date().getMonth()).length;
  const dueToday = activityRows.filter((row) => row.activity.dueDate && String(row.activity.dueDate).slice(0, 10) === today() && row.activity.status === "open").length;
  const overdueCount = activityRows.filter((row) => row.activity.dueDate && String(row.activity.dueDate).slice(0, 10) < today() && row.activity.status === "open").length;
  const waitingQuotes = (quotations.data ?? []).filter((quote) => ["pending_approval", "sent", "viewed"].includes(quote.status)).length;
  const submitOpportunity = (event: React.FormEvent) => { event.preventDefault(); if (!me.data?.id || !customerId || !title.trim()) return; createOpportunity.mutate({ ...base, customerId: Number(customerId), ownerUserId: me.data.id, title: title.trim(), expectedValue, serviceInterest: serviceInterest.trim() || undefined, stage: "new_lead", probability: 10 }); };
  const submitActivity = (event: React.FormEvent) => { event.preventDefault(); if (!me.data?.id || !activityCustomerId || !activitySubject.trim()) return; createActivity.mutate({ ...base, customerId: Number(activityCustomerId), ownerUserId: me.data.id, subject: activitySubject.trim(), activityType: "task", dueDate: activityDueDate || undefined, notes: activityNotes.trim() || undefined }); };
  if (!enabled) return null;
  return <section className="space-y-5" dir="rtl">
    <Card className="border-0 bg-[#103d3a] text-white shadow-sm"><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold tracking-[0.16em] text-[#b8d9c5]">SALES WORKSPACE</p><h2 className="mt-2 text-2xl font-bold">مساحة عملي البيعية</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-white/75">كل ما تحتاجه لاستقبال العميل، تأهيل الفرصة، إرسال العرض، والمتابعة حتى الإغلاق.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => setShowOpportunityForm((value) => !value)} className="bg-white text-[#0b3d3a] hover:bg-[#eef5f0]"><Plus className="ml-2 h-4 w-4" />عميل محتمل</Button><Button onClick={() => setShowActivityForm((value) => !value)} variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20"><CalendarClock className="ml-2 h-4 w-4" />متابعة</Button><Button onClick={() => setShowQuotationForm((value) => !value)} variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20"><FileText className="ml-2 h-4 w-4" />عرض سعر</Button></div></div></CardContent></Card>
    <div id="sales-rep-leads" className="scroll-mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={UsersRound} label="العملاء المحتملون المسندون" value={rows.filter((row) => row.opportunity.stage === "new_lead").length} /><Metric icon={CalendarClock} label="متابعات اليوم" value={dueToday} /><Metric icon={Target} label="الفرص المفتوحة" value={open.length} /><Metric icon={CheckCircle2} label="الصفقات المغلقة هذا الشهر" value={wonThisMonth} /></div>
    <div id="sales-rep-performance" className="scroll-mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Send} label="عروض السعر المرسلة" value={proposals.length} /><Metric icon={FileText} label="عروض تنتظر الرد" value={waitingQuotes} /><Metric icon={CircleDollarSign} label="قيمة خطي البيعي" value={money(metrics?.weightedPipeline)} text /><Metric icon={ListTodo} label="المهام المتأخرة" value={overdueCount} /></div>
    <span id="sales-rep-dashboard" className="sr-only" />
    {showQuotationForm && <div id="sales-rep-quotations" className="scroll-mt-6"><SalesRepQuotationPanel base={base} customers={customers.data ?? []} /></div>}
    {(showOpportunityForm || showActivityForm) && <div id="sales-rep-tasks" className="scroll-mt-6 grid gap-5 lg:grid-cols-2">
      {showOpportunityForm && <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">تسجيل عميل محتمل / فرصة</CardTitle></CardHeader><CardContent><form onSubmit={submitOpportunity} className="space-y-4"><div><Label htmlFor="rep-opportunity-title">اسم الفرصة</Label><Input id="rep-opportunity-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: طلب نظام مالي" required /></div><div><Label>العميل</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="اختر عميلاً مسنداً لك" /></SelectTrigger><SelectContent>{(customers.data ?? []).map((customer) => <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="rep-opportunity-value">القيمة التقريبية</Label><Input id="rep-opportunity-value" dir="ltr" value={expectedValue} onChange={(event) => setExpectedValue(event.target.value)} inputMode="decimal" /></div><div><Label htmlFor="rep-service-interest">الخدمة أو الباقة</Label><Input id="rep-service-interest" value={serviceInterest} onChange={(event) => setServiceInterest(event.target.value)} /></div></div><Button type="submit" disabled={createOpportunity.isPending || !customerId} className="w-full bg-[#0b3d3a]">حفظ الفرصة</Button></form></CardContent></Card>}
      {showActivityForm && <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">إضافة متابعة</CardTitle></CardHeader><CardContent><form onSubmit={submitActivity} className="space-y-4"><div><Label>العميل</Label><Select value={activityCustomerId} onValueChange={setActivityCustomerId}><SelectTrigger><SelectValue placeholder="اختر عميلاً" /></SelectTrigger><SelectContent>{(customers.data ?? []).map((customer) => <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="rep-activity-subject">موضوع المتابعة</Label><Input id="rep-activity-subject" value={activitySubject} onChange={(event) => setActivitySubject(event.target.value)} placeholder="اتصال أو اجتماع أو تذكير" required /></div><div><Label htmlFor="rep-activity-date">التاريخ</Label><Input id="rep-activity-date" type="date" dir="ltr" value={activityDueDate} onChange={(event) => setActivityDueDate(event.target.value)} /></div><div><Label htmlFor="rep-activity-notes">ملاحظات</Label><Textarea id="rep-activity-notes" value={activityNotes} onChange={(event) => setActivityNotes(event.target.value)} /></div><Button type="submit" disabled={createActivity.isPending || !activityCustomerId} className="w-full bg-[#0b3d3a]">حفظ المتابعة</Button></form></CardContent></Card>}
    </div>}
    <div id="sales-rep-opportunities" className="scroll-mt-6 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]"><Card className="border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">فرصي البيعية</CardTitle><p className="mt-1 text-sm text-muted-foreground">تظهر هنا الفرص المسندة إليك فقط.</p></div><Badge variant="outline">{rows.length} فرصة</Badge></CardHeader><CardContent><div className="space-y-2">{rows.slice(0, 12).map((row) => <div key={row.opportunity.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7ece8] p-3"><div className="min-w-0"><p className="truncate font-semibold text-[#18332f]">{row.opportunity.title}</p><p className="mt-1 text-xs text-muted-foreground">{row.customerName ?? "—"} · {stageLabels[row.opportunity.stage] ?? row.opportunity.stage}</p></div><span className="font-semibold text-[#0b5a45]" dir="ltr">{money(row.opportunity.expectedValue)}</span></div>)}{!rows.length && <Empty text="لا توجد فرص مسندة لك بعد." />}</div></CardContent></Card><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">متابعاتي القادمة</CardTitle></CardHeader><CardContent><div className="space-y-2">{activityRows.slice(0, 8).map((row) => <div key={row.activity.id} className="rounded-xl bg-[#f7faf7] p-3"><div className="flex items-center justify-between gap-2"><p className="font-medium">{row.activity.subject}</p><span className="text-xs text-muted-foreground" dir="ltr">{row.activity.dueDate ? String(row.activity.dueDate).slice(0, 10) : "بدون تاريخ"}</span></div><p className="mt-1 text-xs text-muted-foreground">{row.customerName ?? "—"}</p></div>)}{!activityRows.length && <Empty text="لا توجد متابعات مسجلة." />}</div></CardContent></Card>    </div>
    <Card id="sales-rep-customers" className="scroll-mt-6 border-0 shadow-sm"><CardHeader><CardTitle className="text-base">عملائي المسندون</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{(customers.data ?? []).slice(0, 12).map((customer) => <Badge key={customer.id} variant="outline" className="px-3 py-1.5">{customer.name}</Badge>)}{!customers.data?.length && <Empty text="لا يوجد عملاء مسندون لك بعد." />}</div></CardContent></Card>
    <Card id="sales-rep-notifications" className="scroll-mt-6 border-0 bg-[#f7faf7] shadow-sm"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-[#18332f]">إشعاراتي</p><p className="mt-1 text-sm text-muted-foreground">لديك {dueToday} متابعة تحتاج إجراء اليوم، وتظهر هنا التنبيهات المرتبطة بعملك فقط.</p></div><Badge className="bg-[#e6f0eb] text-[#0b5a45] hover:bg-[#e6f0eb]">{dueToday} اليوم</Badge></CardContent></Card>
    <Card id="sales-rep-profile" className="scroll-mt-6 border-0 shadow-sm"><CardContent className="p-4"><p className="font-semibold text-[#18332f]">حسابي</p><p className="mt-1 text-sm text-muted-foreground">تُدار صلاحيات هذا الحساب من الإدارة، ولا تتضمن هذه المساحة إعدادات الشركة أو الصلاحيات المالية.</p></CardContent></Card>
  </section>;
}

function Metric({ icon: Icon, label, value, text = false }: { icon: typeof Target; label: string; value: number | string; text?: boolean }) { return <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f0eb] text-[#0b5a45]"><Icon className="h-4 w-4" /></div><strong className="text-xl text-[#18332f]" dir={text ? "ltr" : undefined}>{value}</strong></div><p className="mt-3 text-sm text-muted-foreground">{label}</p></CardContent></Card>; }
function SalesRepQuotationPanel({ base, customers }: { base: { tenantId: number; companyId: number }; customers: Array<{ id: number; name: string }> }) {
  const services = trpc.sales.listServices.useQuery(base);
  const quotes = trpc.sales.listQuotations.useQuery(base);
  const [customerId, setCustomerId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const service = services.data?.find((item) => String(item.id) === serviceId);
  const create = trpc.sales.createQuotation.useMutation({ onSuccess: async () => { toast.success("تم حفظ عرض السعر برقم تلقائي."); setCustomerId(""); setServiceId(""); await quotes.refetch(); }, onError: (error) => toast.error(error.message) });
  return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-[#0b5a45]" />إنشاء عرض سعر</CardTitle><p className="text-sm text-muted-foreground">يُحفظ العرض باسمك، ويظل تحويله إلى فاتورة من صلاحية المشرف أو المحاسب.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div><Label>العميل المسند</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger><SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}</SelectItem>)}</SelectContent></Select></div><div><Label>الخدمة</Label><Select value={serviceId} onValueChange={setServiceId}><SelectTrigger><SelectValue placeholder="اختر الخدمة" /></SelectTrigger><SelectContent>{(services.data ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.nameAr}</SelectItem>)}</SelectContent></Select></div></div><div className="rounded-xl bg-[#f7faf7] p-3 text-sm text-muted-foreground">رقم العرض والتاريخ يُولّدان تلقائياً من النظام. لا تظهر هنا أدوات الخصم المالي أو الإصدار.</div><Button disabled={!customerId || !service || create.isPending || !service.unitPrice || Number(service.unitPrice) <= 0} className="w-full bg-[#0b3d3a]" onClick={() => service && create.mutate({ ...base, customerId: Number(customerId), issueDate: new Date().toISOString().slice(0, 10), lines: [{ productServiceId: service.id, description: service.nameAr, quantity: "1", unitPrice: service.unitPrice, discountAmount: "0", taxRateBps: 1500 }] })}>حفظ وإرسال للمراجعة</Button><div className="space-y-2"><p className="text-sm font-semibold text-[#18332f]">آخر عروضي</p>{(quotes.data ?? []).slice(0, 4).map((quote) => <div key={quote.id} className="flex items-center justify-between rounded-xl border p-3 text-sm"><span dir="ltr">{quote.quoteNumber}</span><Badge variant="outline">{quote.status}</Badge></div>)}{!quotes.data?.length && <Empty text="لا توجد عروض مسندة لك بعد." />}</div></CardContent></Card>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">{text}</p>; }
