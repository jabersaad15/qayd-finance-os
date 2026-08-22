export type ZatcaEgsSelectionCandidate = {
  id: number;
  serialNumber: string;
  csrStatus: string;
  complianceCsidStatus: string;
};

export function selectPreferredSimulationEgsId(egs: ZatcaEgsSelectionCandidate[]) {
  if (!egs.length) return null;
  return egs.find((item) => item.serialNumber === "QAYD-EGS-SIM-001")?.id
    ?? egs.find((item) => item.csrStatus === "not_started" && item.complianceCsidStatus === "not_started")?.id
    ?? egs[0].id;
}
