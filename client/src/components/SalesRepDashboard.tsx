import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarDays, CheckCircle2, MapPinned, Target, TrendingUp, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";

const money = (value?: string) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(Number(value)) : "SAR 0.00";
const number = (value?: number) => new Intl.NumberFormat("en-US").format(value ?? 0);

export function SalesRepDashboard({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const enabled = Boolean(tenantId && companyId);
  const baseInput = useMemo(() => ({ tenantId: tenantId ?? 0, companyId: companyId ?? 0 }), [tenantId, companyId]);
  const reps = trpc.sales.listSalesAssignees.useQuery(baseInput, { enabled });
  const [repId, setRepId] = useState(() => reps.data?.[0] ? String(reps.data[0].userId) : "");
  useEffect(() => { if (!repId && reps.data?.[0]) setRepId(String(reps.data[0].userId)); }, [repId, reps.data]);
  const dashboardInput = useMemo(() => ({ ...baseInput, salesRepUserId: Number(repId) }), [baseInput, repId]);
  const dashboard = trpc.sales.salesRepDashboard.useQuery(dashboardInput, { enabled: enabled && Boolean(repId) });
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const handleMapReady = useCallback((map: google.maps.Map) => { mapRef.current = map; }, []);
  const mappedVisits = (dashboard.data?.visits ?? []).filter((row) => row.visit.visitType === "in_person" && row.visit.latitude !== null && row.visit.longitude !== null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dashboard.data) return;
    markersRef.current.forEach((marker) => { marker.map = null; });
    markersRef.current = mappedVisits.map((row) => {
      const position = { lat: Number(row.visit.latitude), lng: Number(row.visit.longitude) };
      const marker = new google.maps.marker.AdvancedMarkerElement({ map, position, title: row.customerName ?? "زيارة ميدانية" });
      marker.addListener("click", () => { const info = new google.maps.InfoWindow({ content: `<div dir="rtl" style="min-width:180px"><strong>${row.customerName ?? "زيارة ميدانية"}</strong><br/>${row.visit.outcome ?? "بدون نتيجة مسجلة"}<br/><small>${new Date(row.visit.visitedAt).toLocaleString("en-GB")}</small></div>` }); info.open({ map, anchor: marker }); });
      return marker;
    });
    if (mappedVisits[0]) map.setCenter({ lat: Number(mappedVisits[0].visit.latitude), lng: Number(mappedVisits[0].visit.longitude) });
  }, [dashboard.data, mappedVisits]);
  if (!enabled) return null;
  const metrics = dashboard.data?.metrics;
  return <section className="mt-5 space-y-5" dir="rtl">
    <Card className="rounded-2xl border-0 bg-[#102f35] text-white shadow-sm"><CardContent className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.16em] text-white/60">FIELD SALES CONTROL</p><h2 className="mt-2 text-2xl font-bold">لوحة تحكم ممثل المبيعات</h2><p className="mt-2 text-sm leading-7 text-white/75">تابع الزيارات الميدانية، نشاط الأسبوع، الفرص المنسوبة، ونسبة الإنجاز من شاشة واحدة.</p></div><MapPinned className="h-9 w-9 text-[#b8e3c8]" /></div><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center"><label className="text-sm text-white/75">ممثل المبيعات المسؤول<select className="mr-2 h-10 min-w-56 rounded-lg border-0 bg-white px-3 text-sm text-[#18383a]" value={repId} onChange={(event) => setRepId(event.target.value)}><option value="">اختر ممثل المبيعات</option>{(reps.data ?? []).map((rep) => <option key={rep.userId} value={rep.userId}>{rep.name || rep.email || `ممثل #${rep.userId}`}</option>)}</select></label><span className="text-xs text-white/60">الأسبوع الحالي · الأرقام بالإنجليزية</span></div></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={MapPinned} label="الزيارات الميدانية" value={number(metrics?.fieldVisits)} tone="green" /><Metric icon={Activity} label="النشاط المكتمل" value={number(metrics?.completedActivities)} tone="blue" /><Metric icon={Target} label="الفرص الرابحة" value={`${number(metrics?.wonOpportunities)} / ${number(metrics?.opportunities)}`} tone="amber" /><Metric icon={TrendingUp} label="نسبة الفوز" value={`${number(metrics?.winRate)}%`} tone="rose" /></div>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]"><Card className="overflow-hidden rounded-2xl border-0 shadow-sm"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><MapPinned className="h-5 w-5 text-[#0b5a45]" />خريطة الزيارات الميدانية</CardTitle><p className="mt-1 text-sm text-muted-foreground">تظهر الزيارات التي تحتوي على إحداثيات محفوظة؛ يمكن فتح تفاصيل الزيارة من العلامة.</p></div><span className="rounded-full bg-[#e9f4ed] px-3 py-1 text-xs font-semibold text-[#0b5a45]" dir="ltr">{number(mappedVisits.length)} mapped</span></CardHeader><CardContent className="p-0"><MapView className="h-[420px]" initialCenter={{ lat: 24.7136, lng: 46.6753 }} initialZoom={11} onMapReady={handleMapReady} /></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5 text-[#0b5a45]" />النشاط الأسبوعي</CardTitle><p className="text-sm text-muted-foreground">عدد الزيارات والأنشطة المسجلة لكل يوم.</p></CardHeader><CardContent className="space-y-3">{(dashboard.data?.weeklyActivity ?? []).map((day) => { const total = day.visits + day.activities; const width = Math.min(100, total * 16); return <div key={day.date} className="grid grid-cols-[44px_1fr_42px] items-center gap-3 text-sm"><span className="font-medium text-[#52635a]">{day.label}</span><div className="h-7 overflow-hidden rounded-lg bg-[#f0f4f1]"><div className="flex h-full items-center rounded-lg bg-[#0b5a45] px-2 text-[11px] text-white transition-all" style={{ width: `${Math.max(width, total ? 18 : 4)}%` }}>{total ? `${day.visits} زيارات · ${day.activities} أنشطة` : "—"}</div></div><span className="text-left font-bold text-[#18383a]" dir="ltr">{number(total)}</span></div>; })}{!dashboard.data?.weeklyActivity?.length && <p className="rounded-xl bg-[#f7f9f7] p-4 text-sm text-muted-foreground">لا توجد بيانات أسبوعية بعد.</p>}</CardContent></Card></div>
    <div className="grid gap-5 xl:grid-cols-3"><SummaryCard icon={UsersRound} title="خط الفرص" rows={[["قيمة مرجحة", money(metrics?.weightedPipeline)], ["إجمالي الفرص", number(metrics?.opportunities)], ["المفتوحة", number(metrics?.openActivities)]]} /><SummaryCard icon={CheckCircle2} title="العمولات" rows={[["معلقة", money(metrics?.pendingCommission)], ["مدفوعة", money(metrics?.paidCommission)], ["زيارات هذا الأسبوع", number(metrics?.totalVisits)]]} /><Card className="rounded-2xl border-0 shadow-sm"><CardHeader><CardTitle className="text-base">ملاحظات الخريطة</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-7 text-muted-foreground"><p>الزيارات التي لا تحتوي على إحداثيات تبقى محفوظة في سجل CRM ولا تظهر على الخريطة حتى يضيف ممثل المبيعات الموقع.</p><p>لتسجيل إحداثيات دقيقة، استخدم حقلي خط العرض وخط الطول عند حفظ الزيارة من لوحة ملكية الاستحواذ.</p></CardContent></Card></div>
  </section>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof MapPinned; label: string; value: string; tone: "green" | "blue" | "amber" | "rose" }) { const tones = { green: "bg-[#e9f4ed] text-[#0b5a45]", blue: "bg-[#e8f0f6] text-[#285c7d]", amber: "bg-[#fbf2df] text-[#946517]", rose: "bg-[#f7ebed] text-[#993e4c]" }; return <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-[#18383a]" dir="ltr">{value}</p></CardContent></Card>; }
function SummaryCard({ icon: Icon, title, rows }: { icon: typeof UsersRound; title: string; rows: Array<[string, string]> }) { return <Card className="rounded-2xl border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5 text-[#0b5a45]" />{title}</CardTitle></CardHeader><CardContent className="space-y-3">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-[#eef2ef] pb-2 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><strong dir="ltr">{value}</strong></div>)}</CardContent></Card>; }
