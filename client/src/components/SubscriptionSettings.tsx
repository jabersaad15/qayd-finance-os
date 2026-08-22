import { Check, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const managementRoles = new Set(["company_admin", "super_admin", "ceo", "cfo"]);

export function SubscriptionSettings({ tenantId, roleCode }: { tenantId?: number; roleCode?: string }) {
  const enabled = Boolean(tenantId);
  const canManage = managementRoles.has(roleCode ?? "");
  const current = trpc.subscriptions.current.useQuery({ tenantId: tenantId ?? 0 }, { enabled });
  const plans = trpc.subscriptions.listPlans.useQuery(undefined, { enabled });
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const changePlan = trpc.subscriptions.changePlan.useMutation({ onSuccess: () => { toast.success("تم تهيئة تجربة الباقة بنجاح."); current.refetch(); }, onError: (error) => toast.error(error.message) });
  if (!enabled) return null;
  const subscription = current.data?.subscription;
  const selectedCode = current.data?.plan?.code;
  return <section className="mt-5 space-y-5" dir="rtl">
    <Card className="rounded-2xl border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-5 w-5 text-[#0b3d3a]" />الاشتراك والباقات</CardTitle><p className="text-sm text-muted-foreground">إدارة الباقة والاستحقاقات التجارية للشركة. الدفع الإلكتروني سيُربط بعد اعتماد بوابة الدفع.</p></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#eef5f1] p-4"><div><p className="text-xs text-muted-foreground">الحالة الحالية</p><p className="font-bold text-[#0b3d3a]">{subscription ? (subscription.status === "trialing" ? "فترة تجريبية" : subscription.status) : "لم يتم اختيار باقة"}</p></div>{current.data?.plan && <><div className="h-8 w-px bg-[#d8e7df]" /><div><p className="text-xs text-muted-foreground">الباقة</p><p className="font-bold">{current.data.plan.nameAr}</p></div></>}{subscription?.trialEndsAt && <Badge variant="secondary">تنتهي التجربة: {new Date(subscription.trialEndsAt).toLocaleDateString("en-GB")}</Badge>}</div>
      <div className="flex items-center gap-2"><Button type="button" size="sm" variant={billingCycle === "monthly" ? "default" : "outline"} className={billingCycle === "monthly" ? "bg-[#0b3d3a]" : ""} onClick={() => setBillingCycle("monthly")}>شهري</Button><Button type="button" size="sm" variant={billingCycle === "annual" ? "default" : "outline"} className={billingCycle === "annual" ? "bg-[#0b3d3a]" : ""} onClick={() => setBillingCycle("annual")}>سنوي</Button></div>
    </CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-4">{(plans.data ?? []).map((plan) => <Card key={plan.code} className={`rounded-2xl border-0 shadow-sm ${selectedCode === plan.code ? "ring-2 ring-[#4A82C4]" : ""}`}><CardHeader><CardTitle className="text-base">{plan.nameAr}</CardTitle><p className="text-xs text-muted-foreground">{plan.descriptionAr ?? "باقة تشغيل مالية للشركات"}</p></CardHeader><CardContent className="space-y-3"><p className="text-2xl font-bold text-[#0b3d3a]">{Number(billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice) > 0 ? <>{billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice} <span className="text-xs font-normal text-muted-foreground">ريال</span></> : <span className="text-base">يحدد من الإدارة</span>}</p><div className="space-y-2 text-xs text-muted-foreground"><p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#4A82C4]" />{plan.maxUsers ?? "غير محدود"} مستخدم</p><p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#4A82C4]" />{plan.maxInvoicesPerMonth ?? "غير محدود"} فاتورة شهرياً</p><p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#4A82C4]" />تجربة {plan.trialDays} يوماً</p></div>{canManage && <Button className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={changePlan.isPending || selectedCode === plan.code} onClick={() => changePlan.mutate({ tenantId: tenantId!, planCode: plan.code, billingCycle })}>{changePlan.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}{selectedCode === plan.code ? "الباقة الحالية" : "بدء التجربة"}</Button>}</CardContent></Card>)}</div>
    {current.data?.entitlements?.length ? <Card className="rounded-2xl border-0 shadow-sm"><CardHeader><CardTitle className="text-base">الاستحقاقات المفعلة</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{current.data.entitlements.map((item) => <div key={item.featureCode} className="rounded-xl bg-[#f6f8f6] p-3 text-sm"><p className="font-semibold">{item.featureCode}</p><p className="text-xs text-muted-foreground">{item.enabled ? "مفعلة" : "موقفة"}{item.limitValue !== null && item.limitValue !== undefined ? ` · الحد ${item.limitValue}` : ""}</p></div>)}</div></CardContent></Card> : null}
    {!canManage && <p className="text-sm text-muted-foreground">عرض الاشتراك متاح للقراءة. تغيير الباقة متاح للرئيس التنفيذي والمدير المالي ومسؤول الشركة فقط.</p>}
  </section>;
}
