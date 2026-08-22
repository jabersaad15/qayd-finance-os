import { describe, expect, it, vi } from "vitest";
import { requestSimulationProductionCsid, runSimulationComplianceCheck, submitSimulationInvoice } from "./zatcaGateway";

describe("ZATCA simulation gateway", () => {
  it("uses simulation endpoints and returns redacted response metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ requestID: "r-1", status: "PASS", warnings: ["warning"], errors: [], referenceNumber: "ref-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await runSimulationComplianceCheck({ invoiceHash: "a".repeat(64), uuid: "123e4567-e89b-12d3-a456-426614174000", invoiceXmlBase64: "X".repeat(160), credential: { token: "token", secret: "secret" } });
    expect(result.status).toBe("PASS");
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/e-invoicing/simulation/compliance/invoices");
    expect((request.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    expect(JSON.stringify(result)).not.toContain("token");
    vi.unstubAllGlobals();
  });

  it("routes standard and simplified submissions separately", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ status: "REPORTED" }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const common = { invoiceHash: "b".repeat(64), uuid: "123e4567-e89b-12d3-a456-426614174000", invoiceXmlBase64: "Y".repeat(160), credential: { token: "token", secret: "secret" } };
    await submitSimulationInvoice({ ...common, flow: "clearance" });
    await submitSimulationInvoice({ ...common, flow: "reporting" });
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("/e-invoicing/simulation/invoices/clearance/single");
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain("/e-invoicing/simulation/invoices/reporting/single");
    vi.unstubAllGlobals();
  });

  it("requests simulation production CSID with the compliance request id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ requestID: "p-1", status: "ISSUED" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestSimulationProductionCsid({ requestId: "c-1", credential: { token: "token", secret: "secret" } });
    expect(result.status).toBe("ISSUED");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(String(request.body)).toContain("c-1");
    vi.unstubAllGlobals();
  });
});
