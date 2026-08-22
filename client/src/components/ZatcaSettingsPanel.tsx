import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { selectPreferredSimulationEgsId } from "@/lib/zatcaSelection";
import { formatZatcaOnboardingError } from "@/lib/zatcaOnboardingMessage";

function StatusBadge({ status }: { status: string }) {
  const positive = ["active", "issued", "connected"].includes(status);
  const pending = ["pending", "onboarding"].includes(status);
  return <Badge className={positive ? "bg-[#d9eee4] text-[#0b3d3a]" : pending ? "bg-[#fff2c7] text-[#725a00]" : "bg-[#eef2ef] text-[#51645b]"}>{status}</Badge>;
}

export function ZatcaSettingsPanel({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const enabled = Boolean(tenantId && companyId);
  const settings = trpc.zatca.settings.useQuery({ tenantId: tenantId!, companyId: companyId! }, { enabled });
  const [deviceName, setDeviceName] = useState("QAYD EGS Simulation");
  const [serialNumber, setSerialNumber] = useState("QAYD-EGS-SIM-001");
  const [invoiceType, setInvoiceType] = useState<"standard" | "simplified" | "both">("both");
  const [selectedEgsId, setSelectedEgsId] = useState<number | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [onboardingNotice, setOnboardingNotice] = useState("");
  const [csrPem, setCsrPem] = useState("");
  const egs = settings.data?.egs ?? [];
  const selectedEgs = useMemo(() => egs.find((item) => item.id === selectedEgsId) ?? egs[0], [egs, selectedEgsId]);
  useEffect(() => {
    if (selectedEgsId !== null || !egs.length) return;
    setSelectedEgsId(selectPreferredSimulationEgsId(egs));
  }, [egs, selectedEgsId]);
  useEffect(() => { setCsrPem(""); setOtp(""); setOtpError(""); setOnboardingNotice(""); }, [selectedEgs?.id]);
  const generateCsr = trpc.zatca.generateCsr.useMutation({ onSuccess: (result) => { setCsrPem(result.csrPem); toast.success("تم توليد CSR في الخادم وحفظ المفتاح الخاص مشفراً."); }, onError: (error) => toast.error(error.message) });
  const createEgs = trpc.zatca.createEgs.useMutation({ onSuccess: async (item) => { setSelectedEgsId(item.id); toast.success("تم إنشاء وحدة EGS للمحاكاة."); await settings.refetch(); }, onError: (error) => toast.error(error.message) });
  const startOnboarding = trpc.zatca.startComplianceOnboarding.useMutation({ onSuccess: async (result) => { setOtp(""); setOtpError(""); setCsrPem(""); setOnboardingNotice(""); toast.success(result.message); await settings.refetch(); }, onError: (error) => { const notice = formatZatcaOnboardingError(error.message); setOtp(""); setOtpError(""); setOnboardingNotice(notice); toast.error(notice); } });
  const handleOtpChange = (value: string) => {
    const normalized = value.replace(/\D/g, "").slice(0, 6);
    setOtp(normalized);
    setOtpError(normalized.length === 0 || normalized.length === 6 ? "" : "أدخل رمز OTP المكوّن من 6 أرقام.");
  };
  const handleStartOnboarding = () => {
    if (!/^\d{6}$/.test(otp)) {
      setOtpError("أدخل رمز OTP المكوّن من 6 أرقام قبل المتابعة.");
      return;
    }
    setOtpError(""); setOnboardingNotice("");
    startOnboarding.mutate({ tenantId: tenantId!, companyId: companyId!, egsId: selectedEgs!.id, otp, csrPem });
  };
  if (!enabled) return null;

  return <section className="mt-5 space-y-5" dir="rtl">
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>إعدادات الفوترة الإلكترونية — ZATCA</span><Badge className="bg-[#e6f0eb] text-[#0b3d3a]">Simulation</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-[#64716a]">تعمل هذه الشاشة على بيئة المحاكاة فقط. لا تحفظ OTP أو تعرض المفاتيح والاعتمادات بعد الإرسال، ولا تسمح بخلط بيانات المحاكاة مع الإنتاج.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>اسم وحدة EGS</Label><Input className="mt-2" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} /></div>
          <div><Label>رقم EGS الداخلي (ليس OTP)</Label><Input className="mt-2" dir="ltr" placeholder="QAYD-EGS-SIM-001" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value.toUpperCase())} /><p className="mt-1 text-xs text-[#6b766f]">استخدم معرّفًا ثابتًا يحتوي حروفًا وأرقامًا؛ رمز FATOORA المؤقت يُدخل لاحقًا في خانة OTP فقط.</p></div>
          <div><Label>نوع الفاتورة</Label><select className="mt-2 h-10 w-full rounded-md border border-[#dce4dd] bg-white px-3 text-sm" value={invoiceType} onChange={(event) => setInvoiceType(event.target.value as typeof invoiceType)}><option value="both">Standard + Simplified</option><option value="standard">Standard</option><option value="simplified">Simplified</option></select></div>
          <div className="flex items-end"><Button className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={!serialNumber || createEgs.isPending} onClick={() => createEgs.mutate({ tenantId: tenantId!, companyId: companyId!, environment: "simulation", deviceName, serialNumber, invoiceType })}>إنشاء وحدة EGS</Button></div>
        </div>
      </CardContent>
    </Card>

    {egs.length > 0 && <Card className="border-0 shadow-sm rounded-2xl"><CardHeader><CardTitle className="text-base">وحدات EGS وحالة الربط</CardTitle></CardHeader><CardContent className="space-y-3">{egs.map((item) => <button type="button" key={item.id} onClick={() => setSelectedEgsId(item.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right ${selectedEgs?.id === item.id ? "border-[#0b3d3a] bg-[#f2f8f4]" : "border-[#e4e9e4] bg-white"}`}><span><span className="block font-medium text-[#29443b]">{item.deviceName}</span><span className="block text-xs text-[#6b766f]" dir="ltr">{item.serialNumber}</span></span><span className="flex flex-wrap gap-2"><StatusBadge status={item.connectionStatus} /><StatusBadge status={item.complianceCsidStatus} /></span></button>)}</CardContent></Card>}

    {selectedEgs && <Card className="border-0 shadow-sm rounded-2xl"><CardHeader><CardTitle className="text-base">بدء Compliance CSID للمحاكاة</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 rounded-xl bg-[#f7f9f7] p-4 text-sm md:grid-cols-4"><span>Environment: <strong>simulation</strong></span><span>CSR: <StatusBadge status={selectedEgs.csrStatus} /></span><span>Compliance CSID: <StatusBadge status={selectedEgs.complianceCsidStatus} /></span><span>Connection: <StatusBadge status={selectedEgs.connectionStatus} /></span></div>
      <div className="rounded-xl border border-[#dce8dd] bg-[#fbfdfb] p-4"><p className="mb-2 text-sm font-semibold text-[#29443b]">الوحدة المحددة للربط: <span dir="ltr">{selectedEgs.serialNumber}</span></p><Label htmlFor="zatca-simulation-otp">رمز OTP للمحاكاة</Label><p className="mt-1 text-xs leading-5 text-[#6b766f]">انسخ الرمز المؤقت من بوابة FATOORA والصقه هنا. لا ترسله في المحادثة ولا تحفظه في مدير كلمات المرور.</p><Input id="zatca-simulation-otp" className="mt-3 h-12 text-center text-lg tracking-[0.45em]" type="password" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} value={otp} onChange={(event) => handleOtpChange(event.target.value)} placeholder="••••••" aria-invalid={Boolean(otpError)} aria-describedby={otpError ? "zatca-otp-error" : "zatca-otp-help"} />{otpError ? <p id="zatca-otp-error" className="mt-2 text-xs font-medium text-red-700" role="alert">{otpError}</p> : <p id="zatca-otp-help" className="mt-2 text-xs text-[#6b766f]">يُستخدم مرة واحدة ويُمسح تلقائيًا بعد النتيجة.</p>}</div>
      <div><div className="flex items-center justify-between gap-3"><Label>CSR PEM</Label><Button type="button" variant="outline" size="sm" disabled={generateCsr.isPending} onClick={() => generateCsr.mutate({ tenantId: tenantId!, companyId: companyId!, egsId: selectedEgs.id })}>{generateCsr.isPending ? "جارٍ التوليد…" : "توليد CSR من الخادم"}</Button></div><Textarea className="mt-2 min-h-36 font-mono text-xs" dir="ltr" value={csrPem} onChange={(event) => setCsrPem(event.target.value)} placeholder="-----BEGIN CERTIFICATE REQUEST-----" /></div>
      <p className="text-xs leading-5 text-[#6b766f]">إذا انتهت صلاحية OTP، أنشئ رمزاً جديداً من بوابة FATOORA Simulation. لن يظهر الرمز في السجل أو الاستجابة.</p>
      {onboardingNotice && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950" role="alert">{onboardingNotice}</p>}
      <Button className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={!/^\d{6}$/.test(otp) || !csrPem || startOnboarding.isPending} onClick={handleStartOnboarding}>{startOnboarding.isPending ? "جارٍ الاتصال بـ ZATCA…" : "بدء ربط ZATCA"}</Button>
    </CardContent></Card>}
  </section>;
}
