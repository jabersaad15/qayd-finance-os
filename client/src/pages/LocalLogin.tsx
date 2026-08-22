import { Building2, LockKeyhole } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PRODUCT_BRAND } from "../../../shared/productBrand";

export default function LocalLogin() {
  const [, setLocation] = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [legalConsent, setLegalConsent] = useState(false);
  const productTitle = import.meta.env.VITE_APP_TITLE || PRODUCT_BRAND.bilingual;
  const utils = trpc.useUtils();
  const login = trpc.auth.localLogin.useMutation({
    onSuccess: async (result) => {
      await utils.auth.me.invalidate();
      setLocation(result.mustChangePassword ? "/change-password" : "/");
    },
    onError: (cause) => setError(cause.message || "تعذر تسجيل الدخول حالياً."),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!legalConsent) { setError("يجب الموافقة على الشروط والأحكام وسياسة الخصوصية قبل الدخول."); return; }
    login.mutate({ identifier, password, acceptTerms: legalConsent, acceptPrivacy: legalConsent });
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-background px-4 py-8 text-foreground sm:px-6" dir="rtl">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6"><ThemeToggle /></div>
      <form onSubmit={submit} className="w-full max-w-[28rem] rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8" noValidate>
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b3d3a] text-white shadow-sm"><Building2 className="h-7 w-7" aria-hidden="true" /></div>
          <h1 className="break-words text-2xl font-bold leading-tight text-[#143a35] sm:text-3xl">{productTitle}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{PRODUCT_BRAND.arabicTagline} <span aria-hidden="true">—</span> {PRODUCT_BRAND.arabicSlogan}</p>
        </div>

        <div className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label className="block w-full text-right leading-6" htmlFor="identifier">البريد الإلكتروني أو اسم المستخدم</Label>
            <Input className="h-12 w-full text-base" id="identifier" type="text" dir="ltr" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="name@example.com أو username" required />
          </div>
          <div className="space-y-2">
            <Label className="block w-full text-right leading-6" htmlFor="password">كلمة المرور</Label>
            <Input className="h-12 w-full text-base" id="password" type="password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </div>
        </div>

        <label className="mt-5 flex w-full items-start gap-3 rounded-2xl border border-[#dce8df] bg-[#fbfdfb] p-3.5 text-right text-xs leading-6 text-[#586e63] sm:p-4">
          <input type="checkbox" checked={legalConsent} onChange={(event) => setLegalConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#0b3d3a]" required />
          <span className="min-w-0 flex-1">أوافق على <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-[#0b3d3a] underline">الشروط والأحكام</a> و<a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[#0b3d3a] underline">سياسة الخصوصية</a> الحالية، وأقر بأن الموافقة تُحفظ مع إصدار السياسة وتاريخها.</span>
        </label>

        {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">{error}</p> : null}
        <Button type="submit" size="lg" className="mt-5 h-12 w-full bg-[#0b3d3a] text-base hover:bg-[#082f2d]" disabled={login.isPending}><LockKeyhole className="ml-2 h-4 w-4" aria-hidden="true" />{login.isPending ? "جارٍ التحقق…" : "تسجيل الدخول"}</Button>
        <button type="button" className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-medium text-[#0b3d3a] underline-offset-4 hover:bg-[#eef5f0] hover:underline" onClick={() => setLocation("/forgot-password")}>نسيت كلمة المرور؟</button>
      </form>
    </main>
  );
}
