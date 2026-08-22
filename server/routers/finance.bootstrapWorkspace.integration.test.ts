import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ getDb }));

import { financeRouter } from "./finance";

function selectResult(rows: unknown[]) {
  return { from: () => ({ where: () => ({ limit: async () => rows }) }) };
}

function createContextDb(existingTenant: boolean) {
  const inserted: unknown[] = [];
  const tx = {
    insert: () => ({ values: async (values: unknown) => { inserted.push(values); return [{ insertId: inserted.length }]; } }),
  };
  return {
    inserted,
    db: {
      select: () => selectResult(existingTenant ? [{ id: 99 }] : []),
      transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
    },
  };
}

describe("finance.bootstrapWorkspace", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ينشئ المستأجر والشركة بالرقم الضريبي ويولّد slug داخلياً", async () => {
    const fixture = createContextDb(false);
    getDb.mockResolvedValue(fixture.db);
    const caller = financeRouter.createCaller({ user: { id: 7 } } as any);

    await expect(caller.bootstrapWorkspace({ vatNumber: "310000000000003", legalName: "Consedra Holding", legalNameAr: "شركة كونسيدرا القابضة" })).resolves.toEqual({ tenantId: 1, companyId: 2, roleId: 3 });
    expect(fixture.inserted).toContainEqual(expect.objectContaining({ slug: "vat-310000000000003", legalName: "Consedra Holding" }));
    expect(fixture.inserted).toContainEqual(expect.objectContaining({ vatNumber: "310000000000003", legalNameAr: "شركة كونسيدرا القابضة" }));
  });

  it("يرفض تسجيل الرقم الضريبي نفسه مرتين", async () => {
    const fixture = createContextDb(true);
    getDb.mockResolvedValue(fixture.db);
    const caller = financeRouter.createCaller({ user: { id: 7 } } as any);

    await expect(caller.bootstrapWorkspace({ vatNumber: "310000000000003", legalName: "Consedra Holding", legalNameAr: "شركة كونسيدرا القابضة" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fixture.inserted).toHaveLength(0);
  });

  it("يفرض رقماً ضريبياً سعودياً من 15 رقماً", async () => {
    const caller = financeRouter.createCaller({ user: { id: 7 } } as any);
    await expect(caller.bootstrapWorkspace({ vatNumber: "123", legalName: "Consedra Holding", legalNameAr: "شركة كونسيدرا القابضة" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
