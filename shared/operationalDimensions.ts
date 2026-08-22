export type ProjectOperationalStatus = "active" | "on_hold" | "closed";

export function isSelectableCostCenter(isActive: boolean): boolean {
  return isActive;
}

export function isSelectableProject(status: ProjectOperationalStatus): boolean {
  return status === "active";
}
