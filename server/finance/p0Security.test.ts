import { describe, expect, it } from "vitest";
import { defaultPermissions, rolePermissionCodes } from "./rbac";
import { assertAuditAppendOnly, assertJournalMutable } from "./guards";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sensitiveCodes = ["invoice.create", "invoice.approve", "journal.create", "journal.post", "payment.create", "payment.approve", "company.manage"];

describe("P0 security invariants", () => {
  it("يحصر دور مساعد الرئيس التنفيذي في التنسيق دون صلاحيات مالية أو إدارية", () => {
    const permissions = rolePermissionCodes.ceo_assistant ?? [];
    expect(permissions).toEqual(["executive.dashboard.view", "executive.followup.create", "executive.alert.view", "office.coordination.manage"]);
    expect(permissions.some((code) => sensitiveCodes.includes(code))).toBe(false);
  });

  it("يضمن أن كل صلاحيات الدور معرفة في كتالوج الصلاحيات", () => {
    const catalog = new Set(defaultPermissions.map((permission) => permission.code));
    for (const permissions of Object.values(rolePermissionCodes)) {
      for (const permission of permissions) expect(catalog.has(permission)).toBe(true);
    }
  });

  it("يحافظ على عدم قابلية تعديل القيود المرحلة وسجل التدقيق", () => {
    expect(() => assertJournalMutable("posted")).toThrow();
    expect(() => assertJournalMutable("voided")).toThrow();
    expect(() => assertAuditAppendOnly("update")).toThrow();
    expect(() => assertAuditAppendOnly("delete")).toThrow();
  });

  it("يفرض حارس العضوية قبل مسارات الموجهات المالية والتشغيلية", () => {
    const routersDir = resolve(process.cwd(), "server/routers");
    const routerFiles = ["sales.ts", "operations.ts", "purchases.ts", "scheduling.ts", "assistant.ts"].map((file) => readFileSync(resolve(routersDir, file), "utf8"));
    for (const source of routerFiles) {
      expect(source).toContain("ctx.user.id");
      expect(source).toContain("input.tenantId");
      expect(source).toContain("input.companyId");
      expect(source).toMatch(/accessCompany\(ctx\.user\.id, input\.tenantId, input\.companyId/);
    }
  });
});
