import { describe, expect, it } from "vitest";
import { defaultDocumentPrefix, formatDocumentNumber, reconcileNextDocumentNumber } from "./documentNumbering";

describe("automatic sales document numbering", () => {
  it("ينشئ أرقام عرض سعر تلقائية تضم سنة الإصدار والتسلسل", () => {
    expect(formatDocumentNumber({ type: "quotation", prefix: defaultDocumentPrefix("quotation"), nextNumber: 1, padding: 3, issueDate: new Date("2026-05-10T00:00:00.000Z") })).toBe("Q-2026-001");
  });

  it("يحافظ على بادئة مخصصة ويضيف السنة عند غياب قالب السنة", () => {
    expect(formatDocumentNumber({ type: "invoice", prefix: "CMC-INV-", nextNumber: 25, padding: 4, issueDate: new Date("2026-01-01T00:00:00.000Z") })).toBe("CMC-INV-2026-0025");
  });

  it("يتجاوز الأرقام القديمة عند غياب قاعدة الترقيم أو تأخرها", () => {
    expect(reconcileNextDocumentNumber({ type: "quotation", configuredNextNumber: 1, padding: 3, issueDate: new Date("2026-08-15T00:00:00.000Z"), existingNumbers: ["Q-2026-001", "Q-2025-009"] })).toBe(2);
  });
});
