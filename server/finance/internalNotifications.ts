import { internalNotifications } from "../../drizzle/schema";
import { PRODUCT_BRAND } from "../../shared/productBrand";

export type InternalNotificationDraft = {
  tenantId: number;
  companyId: number;
  recipientUserId?: number;
  eventType: string;
  titleAr: string;
  bodyAr: string;
  entityType: string;
  entityId: number;
};

type InternalNotificationWriter = {
  insert: (table: typeof internalNotifications) => { values: (entry: InternalNotificationDraft) => Promise<unknown> };
};

export function teamInvitationNotification(input: { tenantId: number; companyId: number; invitationId: number; email: string; roleName: string; recipientUserId?: number }) {
  return { tenantId: input.tenantId, companyId: input.companyId, recipientUserId: input.recipientUserId, eventType: "team.member_invited", titleAr: "دعوة عضو جديدة", bodyAr: `تمت دعوة ${input.email} بدور ${input.roleName}. يُفعل الوصول عند دخول العضو بالبريد نفسه.`, entityType: "company_member_invitation", entityId: input.invitationId } satisfies InternalNotificationDraft;
}

export function teamRoleChangedNotification(input: { tenantId: number; companyId: number; memberId: number; recipientUserId: number; roleName: string }) {
  return { tenantId: input.tenantId, companyId: input.companyId, recipientUserId: input.recipientUserId, eventType: "team.member_role_changed", titleAr: "تم تغيير دور عضو", bodyAr: `تم تحديث دورك في ${PRODUCT_BRAND.bilingual} إلى: ${input.roleName}.`, entityType: "tenant_user", entityId: input.memberId } satisfies InternalNotificationDraft;
}

export function teamAccessDisabledNotification(input: { tenantId: number; companyId: number; memberId: number; recipientUserId: number }) {
  return { tenantId: input.tenantId, companyId: input.companyId, recipientUserId: input.recipientUserId, eventType: "team.member_access_disabled", titleAr: "تم إيقاف الوصول إلى الشركة", bodyAr: `تم إيقاف عضويتك في مساحة عمل ${PRODUCT_BRAND.bilingual}. تواصل مع الرئيس التنفيذي أو مدير الشركة عند الحاجة.`, entityType: "tenant_user", entityId: input.memberId } satisfies InternalNotificationDraft;
}

export function approvalCaseNotification(input: { tenantId: number; companyId: number; recipientUserId?: number; caseId: number; eventType: "approval.created" | "approval.approved" | "approval.rejected" | "approval.returned" | "approval.information_required"; requestNumber: string; note?: string }) {
  const labels = { "approval.created": "طلب موافقة جديد", "approval.approved": "تم اعتماد الطلب", "approval.rejected": "تم رفض الطلب", "approval.returned": "أعيد الطلب للتعديل", "approval.information_required": "معلومات إضافية مطلوبة" } as const;
  return { tenantId: input.tenantId, companyId: input.companyId, recipientUserId: input.recipientUserId, eventType: `central.${input.eventType}`, titleAr: labels[input.eventType], bodyAr: `الطلب ${input.requestNumber}${input.note ? `: ${input.note}` : "."}`, entityType: "approval_case", entityId: input.caseId } satisfies InternalNotificationDraft;
}

export async function createInternalNotification(writer: InternalNotificationWriter, notification: InternalNotificationDraft) {
  return writer.insert(internalNotifications).values(notification);
}
