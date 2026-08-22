export const DEFAULT_WORKSPACE_SETUP = {
  vatNumber: "310000000000003",
  legalName: "Consedra Holding",
  legalNameAr: "شركة كونسيدرا القابضة",
} as const;

export function toWorkspaceBootstrapInput(input: { vatNumber: string; legalName: string; legalNameAr: string }) {
  return {
    vatNumber: input.vatNumber.replace(/\s/g, ""),
    legalName: input.legalName.trim(),
    legalNameAr: input.legalNameAr.trim(),
  };
}
