import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { auditLogs } from "../../drizzle/schema";
import { appendAuditLog } from "./auditLog";

describe("audit log append-only gateway", () => {
  it("يكتب السجل عبر insert فقط مع كامل بيانات الأثر", async () => {
    const values = vi.fn().mockResolvedValue({ insertId: 8 });
    const writer = { insert: vi.fn(() => ({ values })) };
    const entry = { tenantId: 1, companyId: 2, actorUserId: 3, action: "invoice.issued", entityType: "invoice", entityId: 7, newValue: { number: "INV-7" } };

    await appendAuditLog(writer as any, entry);
    expect(writer.insert).toHaveBeenCalledWith(auditLogs);
    expect(values).toHaveBeenCalledWith(entry);
  });

  it("لا تسمح المسارات التشغيلية بأي update أو delete على جدول سجل التدقيق", () => {
    for (const file of ["server/routers/sales.ts", "server/routers/documents.ts", "server/routers/assistant.ts"]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/\.(update|delete)\(auditLogs\)/);
      expect(source).not.toContain("import { auditLogs");
      expect(source).toContain("appendAuditLog");
    }
  });
});
