import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.hoisted(() => vi.fn());
const appendAuditLog = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb }));
vi.mock("../finance/auditLog", () => ({ appendAuditLog }));

import { salesRouter } from "./sales";

type DbAction = { type: "insert" | "update"; values?: unknown };

function queryResult(rows: unknown[]) {
  const terminal = { limit: async () => rows, orderBy: async () => rows, then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject) };
  return { from: () => ({ leftJoin: () => ({ where: () => terminal }), where: () => terminal }) };
}

function createDraftIssueDb(hasOpenPeriod = true) {
  const actions: DbAction[] = [];
  const dbResponses = [
    [{ id: 1, roleCode: "finance_manager" }],
    [{ id: 1, status: "active", vatNumber: "310000000000003" }],
    [{ id: 77, tenantId: 1, companyId: 1, customerId: 22, invoiceNumber: "INV-2026-010", invoiceType: "standard", status: "draft", issueDate: new Date("2026-08-15T00:00:00.000Z") }],
    [
      { id: 401, quantity: "1.000000", unitPrice: "1000.000000", discountAmount: "0.000000", taxRate: "15.00" },
      { id: 402, quantity: "1.000000", unitPrice: "500.000000", discountAmount: "0.000000", taxRate: "15.00" },
    ],
    [{ id: 18 }],
    [{ code: "1200" }, { code: "2200" }, { code: "4100" }],
    hasOpenPeriod ? [{ id: 31, status: "open" }] : [],
    [
      { id: 1200, code: "1200" },
      { id: 2200, code: "2200" },
      { id: 4100, code: "4100" },
    ],
  ];
  let insertId = 600;
  const insert = () => ({ values: async (values: unknown) => { actions.push({ type: "insert", values }); insertId += 1; return [{ insertId }]; } });
  const tx = {
    insert,
    update: () => ({ set: (values: unknown) => ({ where: async () => { actions.push({ type: "update", values }); return [{ affectedRows: 1 }]; } }) }),
  };
  return {
    actions,
    db: {
      select: () => queryResult(dbResponses.shift() ?? []),
      insert,
      update: () => ({ set: (values: unknown) => ({ where: async () => { actions.push({ type: "update", values }); return [{ affectedRows: 1 }]; } }) }),
      transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
    },
  };
}

describe("draft invoice issue acceptance flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendAuditLog.mockResolvedValue(undefined);
  });

  it("يراجع VAT ويعتمد المسودة ويرحل قيد العملاء والإيراد والضريبة مرة واحدة", async () => {
    const fixture = createDraftIssueDb();
    getDb.mockResolvedValue(fixture.db);
    const caller = salesRouter.createCaller({ user: { id: 7 } } as any);

    const result = await caller.issueDraftInvoice({ tenantId: 1, companyId: 1, invoiceId: 77 });

    expect(result).toMatchObject({ invoiceId: 77, invoiceNumber: "INV-2026-010", totals: { subtotal: "1500.000000", taxTotal: "225.000000", grandTotal: "1725.000000" }, compliance: { canIssue: true, score: 100 } });
    expect(fixture.actions).toContainEqual(expect.objectContaining({ type: "insert", values: expect.objectContaining({ invoiceId: 77, hasCriticalErrors: false, score: 100 }) }));
    expect(fixture.actions).toContainEqual(expect.objectContaining({ type: "update", values: expect.objectContaining({ status: "approved", taxTotal: "225.000000", grandTotal: "1725.000000" }) }));
    expect(fixture.actions).toContainEqual(expect.objectContaining({ type: "insert", values: expect.objectContaining({ sourceType: "invoice", sourceId: 77, status: "posted", debitTotal: "1725.000000", creditTotal: "1725.000000" }) }));
    expect(fixture.actions).toContainEqual(expect.objectContaining({ type: "insert", values: expect.arrayContaining([expect.objectContaining({ accountId: 1200, debit: "1725.000000", credit: "0.000000" }), expect.objectContaining({ accountId: 4100, credit: "1500.000000", debit: "0.000000" }), expect.objectContaining({ accountId: 2200, credit: "225.000000", debit: "0.000000" })]) }));
    expect(fixture.actions).toContainEqual(expect.objectContaining({ type: "insert", values: expect.objectContaining({ invoiceId: 77, status: "queued", operation: "clearance" }) }));
    expect(appendAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "invoice.draft_issued", entityId: 77 }));
  });

  it("يمنع الإصدار برسالة تنفيذية واضحة عند غياب الفترة المالية المفتوحة دون إنشاء امتثال أو قيد", async () => {
    const fixture = createDraftIssueDb(false);
    getDb.mockResolvedValue(fixture.db);
    const caller = salesRouter.createCaller({ user: { id: 7 } } as any);

    await expect(caller.issueDraftInvoice({ tenantId: 1, companyId: 1, invoiceId: 77 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("لا تملك فترة مالية مفتوحة"),
    });

    expect(fixture.actions).not.toContainEqual(expect.objectContaining({ type: "insert", values: expect.objectContaining({ invoiceId: 77, hasCriticalErrors: false }) }));
    expect(fixture.actions).not.toContainEqual(expect.objectContaining({ type: "insert", values: expect.objectContaining({ sourceType: "invoice", sourceId: 77 }) }));
    expect(fixture.actions).not.toContainEqual(expect.objectContaining({ type: "update", values: expect.objectContaining({ status: "approved" }) }));
    expect(appendAuditLog).not.toHaveBeenCalled();
  });
});
