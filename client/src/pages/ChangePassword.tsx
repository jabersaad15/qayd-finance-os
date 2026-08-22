import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function ChangePassword() {
  const [, setLocation] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const changePassword = trpc.auth.changePassword.useMutation({ onSuccess: () => setLocation("/"), onError: (cause) => setError(cause.message) });
  const submit = (event: React.FormEvent) => { event.preventDefault(); setError(""); if (newPassword.length < 8) return setError("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل."); if (newPassword !== confirmation) return setError("تأكيد كلمة المرور غير مطابق."); changePassword.mutate({ newPassword }); };
  return <main className="flex min-h-screen items-center justify-center bg-background p-5" dir="rtl"><form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-8 shadow-sm"><div><h1 className="text-2xl font-bold text-[#143a35]">تغيير كلمة المرور</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">هذه كلمة مرور مؤقتة. اختر كلمة جديدة لا يعرفها غيرك.</p></div><div className="space-y-2"><Label htmlFor="new-password">كلمة المرور الجديدة</Label><Input id="new-password" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /></div><div className="space-y-2"><Label htmlFor="confirmation">تأكيد كلمة المرور</Label><Input id="confirmation" type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required /></div>{error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}<Button type="submit" className="w-full bg-[#0b3d3a]" disabled={changePassword.isPending}>{changePassword.isPending ? "جارٍ الحفظ…" : "حفظ كلمة المرور الجديدة"}</Button></form></main>;
}
