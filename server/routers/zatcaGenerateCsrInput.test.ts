import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.hoisted(() => vi.fn());
const appendAuditLog = vi.hoisted(() => vi.fn());
const generateSimulationCsr = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb }));
vi.mock("../finance/auditLog", () => ({ appendAuditLog }));
vi.mock("../finance/zatcaCrypto", () => ({ encryptZatcaSecret: (value: string) => `encrypted:${value}`, decryptZatcaSecret: (value: string) => value }));
vi.mock("../finance/zatcaCsrService", () => ({
  generateSimulationCsr,
  selectCsrLegalName: (legalNameEn: string | null | undefined, legalNameAr: string) => legalNameEn?.trim() || legalNameAr,
}));

import { zatcaRouter } from "./zatca";

function queryResult(rows: unknown[]) {
  const terminal = { limit: async () => rows, then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject) };
  return { from: () => ({ leftJoin: () => ({ where: () => terminal }), where: () => terminal }) };
}

function createZatcaDb(company: { legalNameAr: string; legalNameEn: string | null }) {
  const responses = [
    [{ memberId: 1, roleCode: "company_admin" }],
    [{ id: 4, serialNumber: "QAYD-EGS-SIM-001", environment: "simulation" }],
    [{ ...company, vatNumber: "314352144600003", email: "info@consedra.com", nationalAddress: "Riyadh National Address", city: "Riyadh", countryCode: "SA" }],
  ];
  return {
    select: () => queryResult(responses.shift() ?? []),
    update: () => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }),
  };
}

describe("zatca.generateCsr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendAuditLog.mockResolvedValue(undefined);
    generateSimulationCsr.mockResolvedValue({ csrPem: "-----BEGIN CERTIFICATE REQUEST-----\ntest\n-----END CERTIFICATE REQUEST-----", privateKeyPem: "private-key" });
  });

  it("يمرر الاسم القانوني الإنجليزي إلى مولد CSR عندما يستدعى إجراء الراوتر فعلياً", async () => {
    getDb.mockResolvedValue(createZatcaDb({ legalNameAr: "شركة كونسيدرا القابضة", legalNameEn: "Consedra Holding" }));

    const result = await zatcaRouter.createCaller({ user: { id: 7 } } as any).generateCsr({ tenantId: 1, companyId: 1, egsId: 4 });

    expect(result).toMatchObject({ egsId: 4, status: "issued" });
    expect(generateSimulationCsr).toHaveBeenCalledWith(expect.objectContaining({ legalName: "Consedra Holding", serialNumber: "QAYD-EGS-SIM-001", vatNumber: "314352144600003" }));
  });

  it("يرجع إلى الاسم العربي عند غياب الاسم الإنجليزي خلال إجراء الراوتر نفسه", async () => {
    getDb.mockResolvedValue(createZatcaDb({ legalNameAr: "شركة كونسيدرا القابضة", legalNameEn: null }));

    await zatcaRouter.createCaller({ user: { id: 7 } } as any).generateCsr({ tenantId: 1, companyId: 1, egsId: 4 });

    expect(generateSimulationCsr).toHaveBeenCalledWith(expect.objectContaining({ legalName: "شركة كونسيدرا القابضة" }));
  });
});
