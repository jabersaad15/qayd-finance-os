import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function MfaSecurityPanel() {
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const enable = trpc.security.enableMfa.useMutation({ onSuccess: (result) => { setSecret(result.secret); toast.success("تم إنشاء سر MFA. أضفه إلى تطبيق المصادقة ثم أدخل الرمز للتأكيد."); }, onError: (error) => toast.error(error.message) });
  const confirm = trpc.security.confirmMfa.useMutation({ onSuccess: () => { setSecret(null); setCode(""); toast.success("تم تفعيل المصادقة متعددة العوامل."); }, onError: (error) => toast.error(error.message) });
  const disable = trpc.security.disableMfa.useMutation({ onSuccess: () => { setCode(""); toast.success("تم تعطيل MFA بعد التحقق."); }, onError: (error) => toast.error(error.message) });
  return <Card className="rounded-2xl border border-[#d6e3d8] shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#0b3d3a]"><KeyRound className="h-5 w-5" />المصادقة متعددة العوامل</CardTitle><p className="text-sm text-muted-foreground">حماية حساب المستخدم المحلي برمز متغير كل 30 ثانية.</p></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><Button className="bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={enable.isPending} onClick={() => enable.mutate()}><ShieldCheck className="ml-2 h-4 w-4" />بدء إعداد MFA</Button></div>{secret && <div className="rounded-xl border border-[#f0c282] bg-[#fff8ed] p-4"><p className="text-sm font-semibold text-[#7e5418]">احفظ هذا السر في تطبيق المصادقة:</p><code dir="ltr" className="mt-2 block break-all rounded bg-white p-2 text-xs">{secret}</code><p className="mt-3 text-xs text-[#7e5418]">بعد إضافته إلى التطبيق، أدخل الرمز المكون من ستة أرقام للتأكيد.</p></div>}<div className="flex gap-2"><Input dir="ltr" inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /><Button variant="outline" disabled={code.length !== 6 || confirm.isPending} onClick={() => confirm.mutate({ code })}>تأكيد التفعيل</Button><Button variant="outline" className="border-red-200 text-red-700" disabled={code.length !== 6 || disable.isPending} onClick={() => disable.mutate({ code })}>تعطيل</Button></div></CardContent></Card>;
}
