import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BarChart3, Plus, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const metricOptions = [
  ["activities_completed", "الأنشطة المكتملة"],
  ["opportunities_won", "الفرص الرابحة"],
  ["completed_visits", "الزيارات المكتملة"],
  ["weighted_pipeline", "خط المبيعات المرجح"],
  ["invoices_issued", "قيمة الفواتير الصادرة"],
  ["overdue_collection", "المبالغ المتأخرة"],
] as const;
const roleOptions = [["sales_rep", "ممثل مبيعات"], ["sales", "مسؤول المبيعات"], ["accountant", "محاسب"], ["finance_manager", "المدير المالي ورئيس الحسابات"]] as const;

export function KpiDashboard({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const enabled = Boolean(tenantId && companyId);
  const dashboard = trpc.kpi.myDashboard.useQuery({ tenantId: tenantId ?? 0, companyId: companyId ?? 0 }, { enabled });
  const utils = trpc.useUtils();
  const [nameAr, setNameAr] = useState("");
  const [metricCode, setMetricCode] = useState<(typeof metricOptions)[number][0]>("activities_completed");
  const [targetValue, setTargetValue] = useState("10");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "quarterly">("monthly");
  const [roleCode, setRoleCode] = useState("sales_rep");
  const create = trpc.kpi.create.useMutation({ onSuccess: async () => { toast.success("تم حفظ مؤشر الأداء."); setNameAr(""); await utils.kpi.myDashboard.invalidate(); }, onError: (error) => toast.error(error.message) });
  const canConfigure = ["company_admin", "super_admin", "cfo", "finance_manager"].includes(dashboard.data?.roleCode ?? "");

  return <section className="space-y-4" dir="rtl">
    <Card className="border-0 bg-white shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-[#18332f]"><BarChart3 className="h-5 w-5 text-[#0b3d3a]" />مؤشرات إنتاجيتي</CardTitle><p className="mt-1 text-sm text-[#6b766f]">الإنجاز الفعلي محسوب من بيانات النظام، وليس من قيم تجريبية.</p></div><Badge variant="outline">{dashboard.data?.kpis.length ?? 0} مؤشرات</Badge></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboard.data?.kpis.map((kpi) => { const target = Number(kpi.targetValue); const actual = Number(kpi.actualValue); const progress = target > 0 ? Math.min(100, actual / target * 100) : 0; return <div key={kpi.id} className="rounded-2xl border border-[#e3ebe5] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#18332f]">{kpi.nameAr}</p><p className="mt-1 text-xs text-[#77827b]">الهدف: <span dir="ltr">{target.toLocaleString("en-US")}</span> · {kpi.period}</p></div><Target className="h-5 w-5 text-[#4d7b65]" /></div><div className="mt-5 flex items-end justify-between"><strong className="text-2xl text-[#102d2b]" dir="ltr">{actual.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong><span className="text-xs text-[#4d7b65]" dir="ltr">{progress.toFixed(0)}%</span></div><Progress value={progress} className="mt-3 h-2" /></div> })}</div>{!dashboard.data?.kpis.length && <div className="rounded-2xl border border-dashed border-[#cbd9d0] p-8 text-center text-sm text-[#6b766f]">لم تُضف مؤشرات مخصصة لدورك بعد.</div>}</CardContent></Card>
    {canConfigure && enabled && <Card className="border-0 bg-[#f7faf7] shadow-sm"><CardHeader><CardTitle className="text-base text-[#18332f]">تخصيص مؤشر جديد</CardTitle><p className="text-sm text-[#6b766f]">يظهر المؤشر تلقائياً لأعضاء الدور المختار، مع بقاء كل موظف ضمن بياناته المسموحة.</p></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><div className="space-y-2"><Label>اسم المؤشر</Label><Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: الزيارات الأسبوعية" /></div><div className="space-y-2"><Label>مصدر القياس</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={metricCode} onChange={(e) => setMetricCode(e.target.value as typeof metricCode)}>{metricOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-2"><Label>الهدف</Label><Input dir="ltr" type="number" min="0.01" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} /></div><div className="space-y-2"><Label>الفترة</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}><option value="daily">يومي</option><option value="weekly">أسبوعي</option><option value="monthly">شهري</option><option value="quarterly">ربع سنوي</option></select></div><div className="space-y-2"><Label>الدور</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div><Button className="mt-5 bg-[#0b3d3a]" disabled={!nameAr.trim() || Number(targetValue) <= 0 || create.isPending} onClick={() => create.mutate({ tenantId: tenantId!, companyId: companyId!, nameAr: nameAr.trim(), metricCode, targetValue: Number(targetValue), period, roleCode })}><Plus className="ml-2 h-4 w-4" />حفظ المؤشر</Button></CardContent></Card>}
  </section>;
}
