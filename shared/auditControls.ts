export type AuditRoleCode = "external_auditor" | "cfo" | "company_admin" | "super_admin" | string;

export function canModifyAuditFinalReport(isLocked: boolean): boolean {
  return !isLocked;
}

export function canFinalizeAuditReport(isLocked: boolean, hasDigitalSignOff: boolean): boolean {
  return !isLocked && hasDigitalSignOff;
}

export function canApproveAuditReopen(roleCode: AuditRoleCode): boolean {
  return ["cfo", "company_admin", "super_admin"].includes(roleCode);
}

export function canActivateAuditEngagement(isIndependenceDeclared: boolean): boolean {
  return isIndependenceDeclared;
}

export function nextIndependenceDeclarationStatus(hasExistingDeclaration: boolean, hasPotentialConflict: boolean): "declared" | "updated" | "conflict_disclosed" {
  if (hasPotentialConflict) return "conflict_disclosed";
  return hasExistingDeclaration ? "updated" : "declared";
}
