import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.hoisted(() => vi.fn());
const storagePut = vi.hoisted(() => vi.fn());
const appendAuditLog = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb }));
vi.mock("../storage", () => ({ storagePut, storageGet: vi.fn(), storageGetSignedUrl: vi.fn() }));
vi.mock("../finance/auditLog", () => ({ appendAuditLog }));

import { documentsRouter } from "./documents";
import { salesRouter } from "./sales";

type DbAction = { type: "insert" | "update"; values?: unknown };

function queryResult(rows: unknown[]) {
  const terminal = { limit: async () => rows, orderBy: async () => rows, then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject) };
  return { from: () => ({ leftJoin: () => ({ where: () => terminal }), where: () => terminal }) };
}

function createAcceptanceDb() {
  const actions: DbAction[] = [];
  const dbResponses = [
    [{ id: 1 }],
    [],
    [{ id: 1, roleCode: "finance_manager" }],
    [{ id: 1, roleCode: "finance_manager" }],
    [],
    [{ id: 44, customerId: 22, subtotal: "1500.000000", taxTotal: "225.000000", grandTotal: "1725.000000", scopeOfWork: "نطاق الاختبار", paymentTerms: "30 يوماً", status: "accepted" }],
    [
      { id: 501, productServiceId: 31, description: "خدمة استشارية", quantity: "1.000000", unitPrice: "1000.000000", discountAmount: "0.000000", lineTotal: "1000.000000", taxRate: "15.00" },
      { id: 502, productServiceId: 32, description: "خدمة تشغيلية", quantity: "1.000000", unitPrice: "500.000000", discountAmount: "0.000000", lineTotal: "500.000000", taxRate: "15.00" },
    ],
    [{ id: 4100 }],
  ];
  const txResponses = [
    [{ id: 9, prefix: "INV-{YYYY}-", nextNumber: 1, padding: 3, isActive: true }],
    [],
  ];
  const buildInsert = () => ({ values: async (values: unknown) => { actions.push({ type: "insert", values }); return [{ insertId: actions.filter((action) => action.type === "insert").length + 300 }]; } });
  const tx = {
    select: () => queryResult(txResponses.shift() ?? []),
    insert: () => buildInsert(),
    update: () => ({ set: (values: unknown) => ({ where: async () => { actions.push({ type: "update", values }); return [{ affectedRows: 1 }]; } }) }),
  };
  return {
    actions,
    db: {
      select: () => queryResult(dbResponses.shift() ?? []),
      insert: () => buildInsert(),
      update: () => ({ set: (values: unknown) => ({ where: async () => { actions.push({ type: "update", values }); return [{ affectedRows: 1 }]; } }) }),
      transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
    },
  };
}

describe("document and quotation acceptance flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storagePut.mockImplementation(async (key: string) => ({ key, url: `https://storage.example/${key}` }));
    appendAuditLog.mockResolvedValue(undefined);
  });

  it("يرفع ملفاً عربياً ويفهرسه، ثم يحول عرضاً متعدد البنود إلى فاتورة مرقمة تلقائياً", async () => {
    const fixture = createAcceptanceDb();
    getDb.mockResolvedValue(fixture.db);
    const context = { user: { id: 7 } } as any;

    const uploaded = await documentsRouter.createCaller(context).upload({ tenantId: 1, companyId: 1, classification: "contract", filename: "عقد كونسيدرا النهائي.pdf", mimeType: "application/pdf", dataBase64: Buffer.from("contract bytes").toString("base64") });
    const converted = await salesRouter.createCaller(context).convertQuotationToDraft({ tenantId: 1, companyId: 1, quotationId: 44, issueDate: "2026-08-15", invoiceType: "standard" });

    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/^[\x00-\x7F]+$/), expect.any(Buffer), "application/pdf");
    expect(storagePut.mock.calls[0][0]).toMatch(/^tenants\/1\/companies\/1\/contract\/document-.*\.pdf$/);
    expect(uploaded.fileKey).toMatch(/^[\x00-\x7F]+$/);
    expect(converted).toEqual({ invoiceId: 303, invoiceNumber: "INV-2026-001", status: "draft" });
    expect(fixture.actions).toContainEqual(expect.objectContaining({ type: "insert", values: expect.objectContaining({ quotationId: 44, invoiceNumber: "INV-2026-001", customerId: 22, status: "draft" }) }));
    expect(fixture.actions).toContainEqual(expect.objectContaining({ type: "insert", values: expect.arrayContaining([expect.objectContaining({ description: "خدمة استشارية" }), expect.objectContaining({ description: "خدمة تشغيلية" })]) }));
    expect(fixture.actions).toContainEqual(expect.objectContaining({ type: "update", values: expect.objectContaining({ status: "converted" }) }));
  });
});
