import { PRODUCT_BRAND } from "../../shared/productBrand";

export function buildTeamOwnerAlert(input: { event: "invited" | "role_changed" | "disabled" | "access_disabled"; subject: string; roleName?: string }) {
  if (input.event === "invited") return { title: `${PRODUCT_BRAND.bilingual}: دعوة عضو جديدة`, content: `تمت دعوة ${input.subject}${input.roleName ? ` بدور ${input.roleName}` : ""}. راجع مركز إشعارات الفريق لمتابعة حالة الدعوة.` };
  if (input.event === "role_changed") return { title: `${PRODUCT_BRAND.bilingual}: تم تغيير دور عضو`, content: `تم تحديث دور ${input.subject} إلى ${input.roleName ?? "دور جديد"}. تم تسجيل العملية في سجل التدقيق.` };
  return { title: `${PRODUCT_BRAND.bilingual}: تم إلغاء وصول عضو`, content: `تم إيقاف وصول ${input.subject} إلى مساحة عمل الشركة مع الإبقاء على السجل التدقيقي.` };
}
