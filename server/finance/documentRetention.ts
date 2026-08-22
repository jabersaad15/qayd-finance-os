export function retentionUntil(createdAt: Date, retentionYears: number): Date {
  const result = new Date(createdAt);
  result.setUTCFullYear(result.getUTCFullYear() + retentionYears);
  return result;
}

export function canDeleteDocument(input: { preventDeletion: boolean; isLegalHold: boolean }): boolean {
  return !input.preventDeletion && !input.isLegalHold;
}

export function canArchiveDocument(input: { isLegalHold: boolean; retentionStatus: "active" | "archived" | "hold" | "expired" }): boolean {
  return !input.isLegalHold && input.retentionStatus !== "hold" && input.retentionStatus !== "archived";
}
