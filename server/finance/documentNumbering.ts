export type AutoDocumentType = "quotation" | "invoice";

export function defaultDocumentPrefix(type: AutoDocumentType): string {
  return type === "quotation" ? "Q-{YYYY}-" : "INV-{YYYY}-";
}

export function formatDocumentNumber(input: { type: AutoDocumentType; prefix?: string; nextNumber: number; padding: number; issueDate: Date }): string {
  const year = input.issueDate.getUTCFullYear().toString();
  const sourcePrefix = input.prefix?.trim() || defaultDocumentPrefix(input.type);
  const prefixWithYear = sourcePrefix.includes("{YYYY}") ? sourcePrefix.replaceAll("{YYYY}", year) : `${sourcePrefix.replace(/-+$/, "")}-${year}-`;
  return `${prefixWithYear}${input.nextNumber.toString().padStart(input.padding, "0")}`;
}

export function reconcileNextDocumentNumber(input: { type: AutoDocumentType; prefix?: string; configuredNextNumber: number; padding: number; issueDate: Date; existingNumbers: string[] }): number {
  const firstCandidate = formatDocumentNumber({ ...input, nextNumber: 1 });
  const prefix = firstCandidate.replace(/1$|0+$/, "");
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sequencePattern = new RegExp(`^${escapedPrefix}(\\d+)$`);
  const highestExisting = input.existingNumbers.reduce((highest, value) => {
    const match = value.match(sequencePattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return Math.max(1, input.configuredNextNumber, highestExisting + 1);
}
