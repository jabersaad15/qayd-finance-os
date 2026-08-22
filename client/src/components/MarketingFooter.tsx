import React from "react";
import { ArrowUpLeft, Building2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { PRODUCT_BRAND } from "../../../shared/productBrand";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#d9e4dd] bg-[#0b3d3a] text-white" dir="rtl">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1.35fr_0.8fr_0.8fr] lg:py-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#b7d8c5]"><Building2 className="h-5 w-5" /></div>
            <div>
              <p className="text-xl font-bold tracking-tight">{PRODUCT_BRAND.bilingual}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-[#b7d8c5]">AI Financial Operating System</p>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-7 text-white/75">{PRODUCT_BRAND.arabicTagline} تجمع المحاسبة والفوترة والإدارة المالية والامتثال والتحليلات في منظومة واحدة، لتحول أرقام الشركة إلى قرارات أفضل.</p>
          <p className="text-sm font-semibold text-[#d7eadf]">{PRODUCT_BRAND.arabicSlogan}</p>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-bold text-[#d7eadf]">روابط قيد</p>
          <Link href="/about" className="flex w-fit items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"><ArrowUpLeft className="h-4 w-4" />من نحن</Link>
          <Link href="/login" className="flex w-fit items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"><ArrowUpLeft className="h-4 w-4" />تسجيل الدخول</Link>
          <Link href="/terms" className="flex w-fit items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"><ArrowUpLeft className="h-4 w-4" />الشروط والأحكام</Link>
          <Link href="/privacy" className="flex w-fit items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"><ArrowUpLeft className="h-4 w-4" />سياسة الخصوصية</Link>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-bold text-[#d7eadf]">الثقة والملكية</p>
          <p className="flex items-start gap-2 text-sm leading-6 text-white/75"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#b7d8c5]" />منصة مستقلة تجارياً، مطوّرة ومملوكة من شركة CONSEDRA.</p>
          <p className="text-xs leading-6 text-white/55">QAYD by CONSEDRA</p>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-4 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} {PRODUCT_BRAND.bilingual}. جميع الحقوق محفوظة.</span><span dir="ltr">{PRODUCT_BRAND.englishSlogan}</span></div></div>
    </footer>
  );
}
