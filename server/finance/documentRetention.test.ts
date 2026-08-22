import { describe, expect, it } from "vitest";
import { canArchiveDocument, canDeleteDocument, retentionUntil } from "./documentRetention";

describe("document retention controls", () => {
  it("يحسب نهاية الاحتفاظ من تاريخ المستند وعدد السنوات", () => {
    expect(retentionUntil(new Date("2026-01-15T00:00:00.000Z"), 7).toISOString()).toBe("2033-01-15T00:00:00.000Z");
  });

  it("يمنع الحذف عند السياسة أو الحجز القانوني ويمنع الأرشفة أثناء الحجز", () => {
    expect(canDeleteDocument({ preventDeletion: true, isLegalHold: false })).toBe(false);
    expect(canDeleteDocument({ preventDeletion: false, isLegalHold: true })).toBe(false);
    expect(canDeleteDocument({ preventDeletion: false, isLegalHold: false })).toBe(true);
    expect(canArchiveDocument({ isLegalHold: true, retentionStatus: "hold" })).toBe(false);
    expect(canArchiveDocument({ isLegalHold: false, retentionStatus: "active" })).toBe(true);
  });
});
