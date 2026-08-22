import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, KeyRound, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trpc } from "@/lib/trpc";
import { PRODUCT_BRAND } from "../../../shared/productBrand";

export default function PasswordReset() {
  const [, setLocation] = useLocation();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setMessage("إذا كان الحساب مسجلاً بهذا البريد أو اسم المستخدم، فستصلك رسالة تحتوي على رابط الاستعادة خلال دقائق. افحص مجلد الرسائل غير المرغوب فيها أيضاً."),
    onError: () => setMessage("إذا كان الحساب مسجلاً بهذا البريد أو اسم المستخدم، فستصلك رسالة تحتوي على رابط الاستعادة خلال دقائق."),
  });
  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setMessage("تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة."),
    onError: (cause) => setError(cause.message || "تعذر تحديث كلمة المرور. اطلب رابطاً جديداً."),
  });

  const submitRequest = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    requestReset.mutate({ identifier });
  };

  const submitReset = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) { setError("يجب أن تتكون كلمة المرور من 8 أحرف أو أرقام على الأقل."); return; }
    if (password !== confirmation) { setError("تأكيد كلمة المرور غير مطابق."); return; }
    resetPassword.mutate({ token, password });
  };

  const isPending = requestReset.isPending || resetPassword.isPending;
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-5 text-foreground" dir="rtl">
      <div className="absolute left-5 top-5"><ThemeToggle /></div>
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b3d3a] text-white"><KeyRound className="h-6 w-6" /></div>
          <h1 className="text-2xl font-bold text-[#143a35]">{token ? "تعيين كلمة مرور جديدة" : "نسيت كلمة المرور؟"}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{PRODUCT_BRAND.arabicTagline} — استعادة آمنة وسريعة لحسابك.</p>
        </div>

        {token ? (
          <form onSubmit={submitReset} className="space-y-5">
            <p className="rounded-xl bg-[#f1f8f3] px-4 py-3 text-sm leading-6 text-[#365a4b]">استخدم كلمة مرور لا تقل عن 8 أحرف أو أرقام. الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة فقط.</p>
            <div className="space-y-2"><Label htmlFor="new-password">كلمة المرور الجديدة</Label><Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">تأكيد كلمة المرور</Label><Input id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} /></div>
            {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">{error}</p> : null}
            {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800" role="status">{message}</p> : null}
            <Button type="submit" className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={isPending}>{isPending ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}</Button>
          </form>
        ) : (
          <form onSubmit={submitRequest} className="space-y-5">
            <p className="rounded-xl bg-[#f1f8f3] px-4 py-3 text-sm leading-6 text-[#365a4b]">أدخل بريدك الإلكتروني أو اسم المستخدم. سنرسل رابطاً مؤقتاً إذا كان الحساب موجوداً، من دون إظهار أي معلومات عن الحساب.</p>
            <div className="space-y-2"><Label htmlFor="reset-identifier">البريد الإلكتروني أو اسم المستخدم</Label><Input id="reset-identifier" type="text" dir="ltr" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="name@example.com أو username" required /></div>
            {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800" role="status"><MailCheck className="mb-1 ml-1 inline-block h-4 w-4" />{message}</p> : null}
            {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">{error}</p> : null}
            <Button type="submit" className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={isPending}>{isPending ? "جارٍ الإرسال…" : "إرسال رابط الاستعادة"}</Button>
          </form>
        )}
        <button type="button" className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-medium text-[#0b3d3a] hover:underline" onClick={() => setLocation("/login")}><ArrowRight className="h-4 w-4" />العودة إلى تسجيل الدخول</button>
      </section>
    </main>
  );
}
