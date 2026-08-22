import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApprovalCenter } from "@/components/ApprovalCenter";
import { AccountantDashboard } from "@/components/AccountantDashboard";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Banknote, BookOpenCheck, Calculator, ChartNoAxesCombined, ClipboardCheck, FileCheck2, Landmark, LockKeyhole, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";

const formatMoney = (value: string | number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(Number(value));

export function FinanceAccountingManagerWorkspace({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const [, navigate] = useLocation();
  const enabled = Boolean(tenantId && companyId);
  const input = useMemo(() => ({ tenantId: tenantId ?? 0, companyId: companyId ?? 0 }), [tenantId, companyId]);
  const balance = trpc.operations.trialBalance.useQuery(input, { enabled });
  const approvals = trpc.approvals.listPending.useQuery(input, { enabled });
  const closing = trpc.audit.dashboard.useQuery(input, { enabled });

  const rows = balance.data ?? [];
  const debit = rows.reduce((sum, row) => sum + Number(row.debit ?? 0), 0);
  const credit = rows.reduce((sum, row) => sum + Number(row.credit ?? 0), 0);
  const difference = debit - credit;
  const periodRows = closing.data?.periods ?? [];
  const currentPeriod = periodRows.find((period) => period.status === "open") ?? periodRows[0];
  const pendingCount = approvals.data?.length ?? 0;

  return <section className="space-y-5" dir="rtl">
    <Card className="border-0 bg-[#103d3a] text-white shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-semibold tracking-[0.16em] text-[#b7d8c5] uppercase">Finance & Accounting Manager</p><h2 className="mt-2 text-2xl font-bold">لوحة المدير المالي ورئيس الحسابات</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">مراجعة واعتماد ومراقبة وتحليل العمليات المالية، مع إبقاء إدارة النظام والأعضاء والاشتراكات خارج هذا الدور.</p></div>
        <Badge className="w-fit bg-white/15 px-3 py-1.5 text-white hover:bg-white/20">Maker–Checker</Badge>
      </CardContent>
    </Card>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveMetric icon={ReceiptText} label="طلبات تحتاج اعتماداً" value={pendingCount.toLocaleString("en-US")} detail="من مركز الاعتمادات" tone="bg-[#fff2e5] text-[#9a5a17]" />
      <ExecutiveMetric icon={Landmark} label="حالة ميزان المراجعة" value={balance.isError ? "—" : Math.abs(difference) < 0.005 ? "متوازن" : formatMoney(Math.abs(difference))} detail={balance.isError ? "تعذر تحميل البيانات" : "المدين مقابل الدائن"} tone="bg-[#e8f4ec] text-[#21663a]" />
      <ExecutiveMetric icon={LockKeyhole} label="الفترة المالية الحالية" value={currentPeriod?.name ?? "—"} detail={currentPeriod?.status ?? "لا توجد فترة"} tone="bg-[#edf2fa] text-[#385f98]" />
      <ExecutiveMetric icon={ShieldCheck} label="نطاق الدور" value="مالي فقط" detail="دون Super Admin" tone="bg-[#f1eee8] text-[#725c36]" />
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <ActionCard icon={ClipboardCheck} title="Accounting Work Queue" description="راجع القيود والمصروفات والمدفوعات والتسويات التي تنتظر قراراً." action="فتح الاعتمادات" onClick={() => navigate("/tax")} />
      <ActionCard icon={BookOpenCheck} title="القيود ودفتر الأستاذ" description="أنشئ أو راجع المسودات وتابع سلامة القيد قبل الترحيل." action="فتح المحاسبة" onClick={() => navigate("/accounting")} />
      <ActionCard icon={WalletCards} title="العمليات والمطابقات" description="راجع الموردين والمصروفات والبنوك وحالات التسوية." action="فتح العمليات" onClick={() => navigate("/operations")} />
      <ActionCard icon={ChartNoAxesCombined} title="القوائم والتحليل" description="اعرض التقارير المالية ومقارنات الفترات من البيانات المرحلة." action="فتح التقارير" onClick={() => navigate("/accounting")} />
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <AccountantDashboard tenantId={tenantId} companyId={companyId} />
      <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-5 w-5 text-[#0b3d3a]" />يحتاج تدخلي اليوم</CardTitle><p className="text-sm text-muted-foreground">تظهر الحالات الفعلية القادمة من الاعتمادات والعمليات، ولا يتم إنشاء تنبيهات تجريبية.</p></CardHeader><CardContent className="space-y-3"><AlertRow icon={FileCheck2} label="طلبات اعتماد معلقة" value={pendingCount} onClick={() => navigate("/tax")} /><AlertRow icon={Calculator} label="فرق ميزان المراجعة" value={balance.isError ? "—" : formatMoney(Math.abs(difference))} onClick={() => navigate("/accounting")} /><AlertRow icon={LockKeyhole} label="حالة الإقفال والفترات" value={currentPeriod?.status ?? "—"} onClick={() => navigate("/audit")} /><Button className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" onClick={() => navigate("/audit")}>مراجعة الإقفال المالي <ArrowLeft className="mr-2 h-4 w-4" /></Button></CardContent></Card>
    </section>

    <ApprovalCenter tenantId={tenantId} companyId={companyId} />
  </section>;
}

function ExecutiveMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof ReceiptText; label: string; value: string; detail: string; tone: string }) { return <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></div><strong className="text-lg text-[#18332f]" dir="ltr">{value}</strong></div><p className="mt-3 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xs text-[#78857e]">{detail}</p></CardContent></Card>; }
function ActionCard({ icon: Icon, title, description, action, onClick }: { icon: typeof ReceiptText; title: string; description: string; action: string; onClick: () => void }) { return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5 text-[#0b3d3a]" />{title}</CardTitle></CardHeader><CardContent><p className="min-h-12 text-sm leading-6 text-muted-foreground">{description}</p><Button variant="outline" className="mt-3 w-full" onClick={onClick}>{action}<ArrowLeft className="mr-2 h-4 w-4" /></Button></CardContent></Card>; }
function AlertRow({ icon: Icon, label, value, onClick }: { icon: typeof FileCheck2; label: string; value: string | number; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-xl border border-[#dfe7e1] bg-[#fbfdfb] p-3 text-right hover:bg-[#f1f6f2]"><span className="flex items-center gap-2 text-sm text-[#2a4035]"><Icon className="h-4 w-4 text-[#0b3d3a]" />{label}</span><Badge variant="outline" dir="ltr">{value}</Badge></button>; }
