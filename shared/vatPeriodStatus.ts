export type VatPeriodStatus = "open" | "prepared" | "filed" | "locked";

const permittedTransitions: Record<VatPeriodStatus, VatPeriodStatus[]> = {
  open: ["open", "prepared"],
  prepared: ["open", "prepared", "filed", "locked"],
  filed: ["filed", "locked"],
  locked: ["locked"],
};

export function canTransitionVatPeriodStatus(from: VatPeriodStatus, to: VatPeriodStatus): boolean {
  return permittedTransitions[from].includes(to);
}
