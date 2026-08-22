export const managedRoleCodes = ["company_admin", "general_manager", "cfo", "finance_manager", "accountant", "external_auditor", "sales", "sales_rep", "read_only", "ceo_assistant", "operations_manager", "executive_assistant"] as const;
export type ManagedRoleCode = (typeof managedRoleCodes)[number];

export function canManageCompanyMembers(roleCode: string | null | undefined) {
  return roleCode === "company_admin" || roleCode === "super_admin";
}

export function assertMemberChangeAllowed(input: { actorUserId: number; targetUserId: number; targetRoleCode?: string | null; activeOwnerCount: number; nextStatus?: "active" | "disabled" }) {
  if (input.actorUserId === input.targetUserId) throw new Error("لا يمكن تعديل دورك أو إلغاء وصولك من هذه الشاشة. استخدم مديراً مخولاً آخر.");
  if (input.targetRoleCode === "company_admin" && input.nextStatus === "disabled" && input.activeOwnerCount <= 1) throw new Error("لا يمكن إلغاء وصول آخر مدير للشركة. عيّن مديراً آخر أولاً.");
}

export function isManagedRoleCode(code: string): code is ManagedRoleCode {
  return (managedRoleCodes as readonly string[]).includes(code);
}
