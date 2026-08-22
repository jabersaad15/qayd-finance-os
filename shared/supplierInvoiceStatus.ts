export type SupplierInvoiceStatus = "draft" | "pending_review" | "approved" | "posted" | "voided";

const transitions: Record<SupplierInvoiceStatus, SupplierInvoiceStatus[]> = {
  draft: ["draft", "pending_review", "voided"],
  pending_review: ["draft", "pending_review", "approved", "voided"],
  approved: ["approved", "posted", "voided"],
  posted: ["posted"],
  voided: ["voided"],
};

export function canTransitionSupplierInvoice(from: SupplierInvoiceStatus, to: SupplierInvoiceStatus): boolean {
  return transitions[from].includes(to);
}
