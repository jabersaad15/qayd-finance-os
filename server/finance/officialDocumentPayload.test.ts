import { describe, expect, it } from "vitest";
import { mapInvoiceToOfficialDocument, mapQuotationToOfficialDocument } from "../../shared/officialDocumentPayload";

const company = { legalNameAr: "شركة كونسيدرا القابضة", commercialRegistration: "7052330474", vatNumber: "314352144600003", nationalAddress: "ARMA3887، الرياض" };
const customer = { name: "عميل اختباري", vatNumber: "300000000000003" };
const lines = [{ description: "استشارة مالية", quantity: "2.000000", unitPrice: "500.000000", lineTotal: "1150.000000" }];

describe("official document payload mapping", () => {
  it("يمرر بيانات عرض السعر الفعلية، بما فيها العميل والبائع والحالة والمبالغ، إلى قالب الطباعة", () => {
    const payload = mapQuotationToOfficialDocument({ quotation: { quoteNumber: "Q-2026-001", issueDate: "2026-08-15", expiryDate: "2026-08-30", scopeOfWork: "إعداد خطة مالية", paymentTerms: "50% عند التعميد", subtotal: "1000.000000", taxTotal: "150.000000", grandTotal: "1150.000000", status: "sent" }, customer, company, lines });
    expect(payload).toMatchObject({ documentNumber: "Q-2026-001", customer, seller: company, status: "sent", subtotal: "1000.000000", taxTotal: "150.000000", grandTotal: "1150.000000", scopeOfWork: "إعداد خطة مالية", paymentTerms: "50% عند التعميد" });
  });

  it("يمرر بيانات الفاتورة الفعلية ويحتفظ ببنودها ومبالغها إلى قالب الطباعة", () => {
    const payload = mapInvoiceToOfficialDocument({ invoice: { invoiceNumber: "INV-2026-001", issueDate: "2026-08-15", scopeOfWork: "استشارة مالية", paymentTerms: "صافي 30 يوماً", subtotal: "1000.000000", taxTotal: "150.000000", grandTotal: "1150.000000", status: "approved" }, customer, company, lines });
    expect(payload).toMatchObject({ documentNumber: "INV-2026-001", customer, seller: company, status: "approved", subtotal: "1000.000000", taxTotal: "150.000000", grandTotal: "1150.000000", lines });
  });
});
