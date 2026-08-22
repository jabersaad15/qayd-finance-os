import React from "react";
import { ArrowRight, BrainCircuit, CheckCircle2, Landmark, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { MarketingFooter } from "@/components/MarketingFooter";
import { PRODUCT_BRAND } from "../../../shared/productBrand";

const pillars = [
  { icon: Landmark, title: "سجل مالي مترابط", text: "تجمع قيد القيود والإيرادات والمصروفات والفواتير والمدفوعات والمستندات في سياق تشغيلي واحد." },
  { icon: BrainCircuit, title: "فهم يقود إلى قرار", text: "تساعد التحليلات والمساعد المالي الذكي الإدارة على فهم الأرقام وربطها بالقرارات، مع إظهار مصدر البيانات ونطاقها." },
  { icon: ShieldCheck, title: "حوكمة وثقة", text: "تعمل الصلاحيات وسجل التدقيق والامتثال ضمن بنية تحافظ على الفصل بين المهام وتحمي بيانات كل شركة." },
];

export default function About() {
  return (
    <div className="min-h-screen bg-[#f6f8f5] text-[#17332f]" dir="rtl">
      <header className="border-b border-[#dce7df] bg-white/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b3d3a]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0b3d3a] text-white"><Landmark className="h-5 w-5" /></span>
            <span><strong className="block text-lg tracking-tight">{PRODUCT_BRAND.bilingual}</strong><span className="block text-[10px] uppercase tracking-[0.14em] text-[#5d776c]">AI Financial Operating System</span></span>
          </Link>
          <div className="flex items-center gap-2"><Link href="/login" className="rounded-xl border border-[#cbdad1] px-4 py-2 text-sm font-semibold text-[#0b3d3a] transition-colors hover:bg-[#eef5f0]">تسجيل الدخول</Link><Link href="/" className="hidden items-center gap-1 rounded-xl bg-[#0b3d3a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#082f2d] sm:flex">العودة للمنصة <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </header>
      <main>
        <section className="relative overflow-hidden bg-[#0b3d3a] px-5 py-16 text-white sm:px-8 sm:py-24"><div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#4a82c4]/20 blur-3xl" /><div className="relative mx-auto max-w-5xl"><p className="mb-4 text-sm font-semibold tracking-[0.18em] text-[#b7d8c5] uppercase">QAYD by CONSEDRA</p><h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">قيد ليست مجرد منصة فواتير أو برنامج محاسبي تقليدي.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-white/75 sm:text-xl">قيد هي <strong className="text-white">نظام التشغيل المالي الذكي للشركات</strong>؛ منظومة مركزية تجمع العمليات المالية والمحاسبية والرقابية وتحول البيانات إلى قرارات.</p><div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#0b3d3a] transition-transform hover:-translate-y-0.5">ابدأ من منصتك <ArrowRight className="h-4 w-4" /></Link><span className="rounded-xl border border-white/20 px-5 py-3 text-sm text-white/75">{PRODUCT_BRAND.arabicSlogan}</span></div></div></section>
        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20"><div className="max-w-3xl"><p className="text-sm font-bold text-[#3f7b64]">فلسفة قيد</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-[#17332f] sm:text-4xl">كل قيد يجمع معنى، وكل معنى يقود إلى قرار.</h2><p className="mt-5 text-base leading-8 text-[#5f7369]">نحن نبني قيد حول العلاقة بين القيد والبيانات والفهم والتحليل والقرار. لذلك لا نعرض الرقم معزولاً؛ بل نربطه بالمصدر والفترة والصلاحية والسياق التشغيلي الذي تحتاجه الإدارة.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3">{pillars.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-[#dce7df] bg-white p-6 shadow-sm"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e6f0eb] text-[#0b3d3a]"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-bold text-[#17332f]">{title}</h3><p className="mt-3 text-sm leading-7 text-[#65776d]">{text}</p></article>)}</div></section>
        <section className="border-y border-[#dce7df] bg-white px-5 py-14 sm:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center"><div><p className="text-sm font-bold text-[#3f7b64]">العلاقة مع CONSEDRA</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-[#17332f]">قيد منتج مستقل تجارياً، مطوّر ومملوك من شركة CONSEDRA.</h2><p className="mt-5 max-w-2xl text-base leading-8 text-[#5f7369]">تظهر علامة قيد في تجربة العميل كاسم المنتج الرئيسي. وتظهر عبارة <strong className="text-[#17332f]">QAYD by CONSEDRA</strong> في المواضع المناسبة للتعريف بالجهة المالكة والمطورة، دون أن تطغى على هوية قيد.</p></div><div className="rounded-3xl bg-[#f0f6f2] p-7"><p className="text-sm font-semibold text-[#557366]">منظومة واحدة</p><p className="mt-3 text-2xl font-bold leading-10 text-[#0b3d3a]">محاسبة، فوترة، امتثال، تحليلات وذكاء مالي في منصة واحدة.</p><div className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#3f7b64]"><CheckCircle2 className="h-4 w-4" /> مصممة للشركات السعودية وطموحها العالمي</div></div></div></section>
      </main>
      <MarketingFooter />
    </div>
  );
}
