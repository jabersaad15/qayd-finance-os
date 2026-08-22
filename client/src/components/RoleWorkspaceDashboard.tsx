import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ClipboardCheck, FileCheck2, ShieldCheck, Target, UsersRound, WalletCards } from "lucide-react";

const roleLabels: Record<string, string> = {
  company_admin: "مدير الشركة",
  super_admin: "مدير النظام",
  cfo: "المدير المالي ورئيس الحسابات",
  finance_manager: "المدير المالي ورئيس الحسابات",
  accountant: "محاسب",
  external_auditor: "مراجع قانوني",
  sales: "مسؤول المبيعات",
  sales_rep: "ممثل مبيعات",
  read_only: "قراءة فقط",
  ceo_assistant: "المساعد الإداري",
  executive_assistant: "مساعد المدير التنفيذي",
};

const roleTasks: Record<string, { title: string; description: string; icon: typeof CheckCircle2 }[]> = {
  company_admin: [
    { title: "مراجعة أعضاء الفريق", description: "تابع الدعوات والأدوار وحالات الوصول.", icon: UsersRound },
    { title: "مراجعة التنبيهات", description: "تحقق من الأحداث الحساسة والموافقات المعلقة.", icon: ShieldCheck },
    { title: "متابعة جاهزية الشركة", description: "أكمل بيانات الشركة والهوية والامتثال.", icon: Target },
  ],
  super_admin: [
    { title: "مراقبة صحة المساحة", description: "راجع حالة الإعدادات والأمان والتكاملات.", icon: ShieldCheck },
    { title: "إدارة الفريق", description: "وزع الأدوار وتابع حالة الحسابات.", icon: UsersRound },
    { title: "مراجعة العمليات الحساسة", description: "تابع سجل التدقيق والتنبيهات المهمة.", icon: ClipboardCheck },
  ],
  cfo: [
    { title: "مركز الاعتمادات", description: "راجع القيود والفواتير والمصروفات والمدفوعات وفق Maker–Checker.", icon: CheckCircle2 },
    { title: "السيولة والذمم", description: "تابع التدفق النقدي والذمم المدينة والدائنة من البيانات المرحلة.", icon: WalletCards },
    { title: "الإقفال والقوائم", description: "راقب جاهزية الفترات والقوائم والتحليل المالي قبل القرار.", icon: FileCheck2 },
  ],
  finance_manager: [
    { title: "مركز الاعتمادات", description: "راجع القيود والفواتير والمصروفات والمدفوعات وفق Maker–Checker.", icon: CheckCircle2 },
    { title: "السيولة والذمم", description: "تابع التدفق النقدي والذمم المدينة والدائنة من البيانات المرحلة.", icon: WalletCards },
    { title: "الإقفال والقوائم", description: "راقب جاهزية الفترات والقوائم والتحليل المالي قبل القرار.", icon: FileCheck2 },
  ],
  accountant: [
    { title: "إصدار ومراجعة الفواتير", description: "راجع الضريبة والفترة المالية قبل الترحيل.", icon: FileCheck2 },
    { title: "مطابقة العمليات", description: "تابع الموردين والمصروفات والمطابقة البنكية.", icon: WalletCards },
    { title: "مهام اليوم", description: "أنجز الأعمال المالية المسندة لك وسجل الملاحظات.", icon: ClipboardCheck },
  ],
  sales: [
    { title: "متابعة خط المبيعات", description: "حدّث الفرص والخطوة التالية لكل عميل.", icon: Target },
    { title: "عروض الأسعار", description: "أنشئ العروض وتابع الموافقات والتحويل للفواتير.", icon: FileCheck2 },
    { title: "نشاط الفريق", description: "راجع الزيارات والتواصل والفرص المسندة.", icon: UsersRound },
  ],
  sales_rep: [
    { title: "متابعاتي اليوم", description: "نفّذ الاتصالات والزيارات المسندة إليك.", icon: ClipboardCheck },
    { title: "فرصي وعملائي", description: "حدّث مرحلة الفرصة والخطوة التالية.", icon: Target },
    { title: "عروضي", description: "تابع عروض الأسعار التي أنشأتها وحالة اعتمادها.", icon: FileCheck2 },
  ],
  external_auditor: [
    { title: "ارتباطات المراجعة", description: "راجع الارتباطات والفترات المسندة إليك فقط.", icon: FileCheck2 },
    { title: "ملاحظات الإقفال", description: "أضف ملاحظات Audit دون فتح الفترة أو تعديلها.", icon: ClipboardCheck },
    { title: "التقرير النهائي", description: "تابع الأدلة والاستقلالية والتوقيع الرقمي.", icon: ShieldCheck },
  ],
  read_only: [
    { title: "التقارير المسموحة", description: "اعرض البيانات التي تسمح بها عضويتك فقط.", icon: FileCheck2 },
    { title: "المستندات", description: "شاهد المستندات المتاحة دون تعديل أو ترحيل.", icon: ClipboardCheck },
  ],
  ceo_assistant: [
    { title: "المهام الإدارية", description: "تابع الأعمال الإدارية العامة والمراسلات والاجتماعات دون وصول مالي.", icon: ClipboardCheck },
    { title: "تنسيق المكتب", description: "نظّم المواعيد والطلبات الإدارية ووجّهها إلى صاحب الصلاحية.", icon: UsersRound },
    { title: "التنبيهات الإدارية", description: "راجع التنبيهات والمتابعات الإدارية المهمة.", icon: ShieldCheck },
  ],
  executive_assistant: [
    { title: "أولويات المدير", description: "اعرف ما يحتاج متابعة اليوم من قرارات ومهام واجتماعات.", icon: Target },
    { title: "الموجز التنفيذي", description: "جهّز Daily CEO Brief وWeekly Executive Brief دون اتخاذ القرار.", icon: FileCheck2 },
    { title: "التفويض المؤقت", description: "تابع التفويضات المسجلة مع منع الاعتماد بالنيابة افتراضياً.", icon: ShieldCheck },
  ],
};

export function RoleWorkspaceDashboard({ roleCode, roleName }: { roleCode?: string | null; roleName?: string | null }) {
  const code = roleCode || "read_only";
  const tasks = roleTasks[code] ?? roleTasks.read_only;
  const label = roleName || roleLabels[code] || "عضو مساحة العمل";

  return <section className="space-y-4" dir="rtl">
    <Card className="border-0 bg-[#103d3a] text-white shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-semibold tracking-[0.16em] text-[#b7d8c5] uppercase">مساحة عملي</p><h2 className="mt-2 text-2xl font-bold">لوحة {label}</h2><p className="mt-2 text-sm text-white/75">هذه الصفحة تعرض ما يخص دورك ومهامك التشغيلية، بينما تُفرض الصلاحيات والبيانات من الخادم.</p></div>
        <Badge className="w-fit bg-white/15 px-3 py-1.5 text-white hover:bg-white/20">{label}</Badge>
      </CardContent>
    </Card>
    <div className="grid gap-4 md:grid-cols-3">{tasks.map(({ title, description, icon: Icon }) => <Card key={title} className="border-0 bg-white shadow-sm"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base text-[#18332f]">{title}</CardTitle><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f0eb] text-[#0b3d3a]"><Icon className="h-4 w-4" /></div></div></CardHeader><CardContent><p className="text-sm leading-6 text-[#6b766f]">{description}</p></CardContent></Card>)}</div>
  </section>;
}
