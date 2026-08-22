import { AlertCircle, ArrowRight, Home } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PRODUCT_BRAND } from "../../../shared/productBrand";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7faf8] px-4 py-8 text-[#143a35]" dir="rtl">
      <section className="w-full max-w-lg rounded-3xl border border-[#dce8df] bg-white p-6 text-center shadow-sm sm:p-10" aria-labelledby="not-found-title">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f2eb] text-[#0b3d3a]"><AlertCircle className="h-8 w-8" aria-hidden="true" /></div>
        <p className="mt-6 text-sm font-semibold tracking-wide text-[#6b7d73]">{PRODUCT_BRAND.bilingual}</p>
        <h1 id="not-found-title" className="mt-2 text-5xl font-bold tracking-tight">404</h1>
        <h2 className="mt-3 text-xl font-bold sm:text-2xl">الصفحة غير موجودة</h2>
        <p className="mt-4 text-sm leading-7 text-[#64756d]">عذرًا، الرابط الذي تبحث عنه غير متاح أو ربما تم نقله. تحقق من الرابط أو عد إلى الصفحة الرئيسية.</p>
        <Button type="button" onClick={() => setLocation("/")} className="mt-7 h-12 w-full rounded-xl bg-[#0b3d3a] text-base text-white hover:bg-[#082f2d] sm:w-auto sm:px-8"><Home className="ml-2 h-4 w-4" aria-hidden="true" />العودة إلى الرئيسية</Button>
        <button type="button" onClick={() => window.history.back()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-[#0b3d3a] hover:bg-[#eef5f0] sm:mt-4"><ArrowRight className="h-4 w-4" aria-hidden="true" />العودة للصفحة السابقة</button>
      </section>
    </main>
  );
}
