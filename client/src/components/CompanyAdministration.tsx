import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Building2, CalendarDays, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const formatDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

function Field({ label, value, onChange, dir = "rtl", placeholder }: { label: string; value: string; onChange: (value: string) => void; dir?: "rtl" | "ltr"; placeholder?: string }) {
  return <label className="text-sm font-medium text-[#44564d]">{label}<Input className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} dir={dir} placeholder={placeholder} /></label>;
}

export function CompanyAdministration({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const enabled = Boolean(tenantId && companyId);
  const input = { tenantId: tenantId ?? 0, companyId: companyId ?? 0 };
  const status = trpc.finance.onboardingStatus.useQuery(input, { enabled });
  const setup = trpc.finance.setupData.useQuery(input, { enabled });
  const utils = trpc.useUtils();
  const [legalNameAr, setLegalNameAr] = useState(""); const [legalNameEn, setLegalNameEn] = useState(""); const [commercialRegistration, setCommercialRegistration] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [city, setCity] = useState(""); const [nationalAddress, setNationalAddress] = useState("");
  const [periodName, setPeriodName] = useState(""); const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10)); const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const company = status.data?.company;
  useEffect(() => { if (!company) return; setLegalNameAr(company.legalNameAr); setLegalNameEn(company.legalNameEn ?? ""); setCommercialRegistration(company.commercialRegistration ?? ""); setEmail(company.email ?? ""); setPhone(company.phone ?? ""); setCity(company.city ?? ""); setNationalAddress(company.nationalAddress ?? ""); }, [company?.id]);
  const refresh = async () => { await Promise.all([utils.finance.onboardingStatus.invalidate(input), utils.finance.setupData.invalidate(input)]); };
  const saveCompany = trpc.finance.updateCompanyProfile.useMutation({ onSuccess: async () => { toast.success("تم تحديث ملف الشركة."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const addPeriod = trpc.finance.addFiscalPeriod.useMutation({ onSuccess: async () => { setPeriodName(""); toast.success("تمت إضافة الفترة المالية."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const updatePeriod = trpc.finance.updateFiscalPeriod.useMutation({ onSuccess: async () => { toast.success("تم تحديث حالة الفترة."); await refresh(); }, onError: (error) => toast.error(error.message) });

  if (!enabled) return null;
  if (status.isLoading || setup.isLoading) return <Card className="mt-5 border-0 shadow-sm rounded-2xl"><CardContent className="flex items-center gap-2 p-6 text-sm text-[#65736a]"><Loader2 className="h-4 w-4 animate-spin" />تحميل إعدادات الشركة...</CardContent></Card>;
  return <section className="mt-5 space-y-5"><Card className="border-0 shadow-sm rounded-2xl"><CardHeader><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f0eb] text-[#0b3d3a]"><Building2 className="h-5 w-5" /></div><div><CardTitle className="text-base">إدارة الشركة الموحدة</CardTitle><p className="mt-1 text-sm text-muted-foreground">إعداد واحد للشركة والإدارة؛ لا تظهر وحدات أو فروع تشغيلية مستقلة.</p></div></div></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="الاسم العربي" value={legalNameAr} onChange={setLegalNameAr} /><Field label="الاسم الإنجليزي" value={legalNameEn} onChange={setLegalNameEn} dir="ltr" /><Field label="السجل / الرقم الموحد" value={commercialRegistration} onChange={setCommercialRegistration} dir="ltr" /><Field label="البريد الإلكتروني" value={email} onChange={setEmail} dir="ltr" /><Field label="الهاتف" value={phone} onChange={setPhone} dir="ltr" /><Field label="المدينة" value={city} onChange={setCity} /><Field label="العنوان الوطني" value={nationalAddress} onChange={setNationalAddress} /><div className="flex items-end"><Button className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={!legalNameAr.trim() || saveCompany.isPending} onClick={() => saveCompany.mutate({ ...input, legalNameAr: legalNameAr.trim(), legalNameEn: legalNameEn.trim() || undefined, commercialRegistration: commercialRegistration.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined, city: city.trim() || undefined, nationalAddress: nationalAddress.trim() || undefined })}>{saveCompany.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ ملف الشركة</Button></div></CardContent></Card>

  <Card className="border-0 shadow-sm rounded-2xl"><CardHeader><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2f8] text-[#385b93]"><CalendarDays className="h-5 w-5" /></div><div><CardTitle className="text-base">الفترات المالية</CardTitle><p className="mt-1 text-sm text-muted-foreground">تُدار الفترات على مستوى الشركة بالكامل، من دون فصل بحسب الفروع.</p></div></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><Field label="اسم الفترة" value={periodName} onChange={setPeriodName} placeholder="FY-2027" /><Field label="تاريخ البداية" value={periodStart} onChange={setPeriodStart} dir="ltr" /><Field label="تاريخ النهاية" value={periodEnd} onChange={setPeriodEnd} dir="ltr" /></div><Button variant="outline" disabled={!periodName.trim() || addPeriod.isPending} onClick={() => addPeriod.mutate({ ...input, name: periodName.trim(), startDate: periodStart, endDate: periodEnd })}>إضافة فترة مالية</Button><div className="space-y-2">{setup.data?.periods.map((period) => <div key={period.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce4dd] bg-[#fbfdfb] p-3"><div><p className="font-semibold text-[#263b32]">{period.name}</p><p className="mt-1 text-xs text-[#6d7a73]" dir="ltr">{formatDate(period.startDate)} — {formatDate(period.endDate)}</p></div><label className="flex items-center gap-2 text-sm text-[#44564d]">الحالة<select value={period.status} disabled={updatePeriod.isPending} onChange={(event) => updatePeriod.mutate({ ...input, periodId: period.id, status: event.target.value as "open" | "soft_locked" | "hard_locked" })} className="h-9 rounded-md border border-[#cfd9d2] bg-white px-2 text-xs"><option value="open">مفتوحة</option><option value="soft_locked">إقفال مبدئي</option><option value="hard_locked">مقفلة</option></select></label></div>)}</div></CardContent></Card></section>;
}
