import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { OfficialDocumentTemplate } from "../../client/src/components/OfficialDocumentTemplate";
import { mapQuotationToOfficialDocument } from "../../shared/officialDocumentPayload";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

describe("official document template", () => {
  it("يعرض حقول العميل والبائع والحالة والمبالغ من ناتج بيانات عرض السعر الفعلي", () => {
    const document = mapQuotationToOfficialDocument({
      quotation: { quoteNumber: "Q-2026-001", issueDate: "2026-08-15", expiryDate: "2026-08-30", scopeOfWork: "إعداد خطة مالية", paymentTerms: "50% عند التعميد", subtotal: "1000.000000", taxTotal: "150.000000", grandTotal: "1150.000000", status: "sent" },
      customer: { name: "عميل اختباري", vatNumber: "300000000000003" },
      company: { legalNameAr: "شركة كونسيدرا القابضة", commercialRegistration: "7052330474", vatNumber: "314352144600003", nationalAddress: "ARMA3887، الرياض" },
      lines: [{ description: "استشارة مالية", quantity: "2.000000", unitPrice: "500.000000", lineTotal: "1150.000000" }],
    });
    const markup = renderToStaticMarkup(<OfficialDocumentTemplate type="quotation" {...document} />);
    expect(markup).toContain("عميل اختباري");
    expect(markup).toContain("شركة كونسيدرا القابضة");
    expect(markup).toContain("مرسل");
    expect(markup).toContain(money(1000));
    expect(markup).toContain(money(150));
    expect(markup).toContain(money(1150));
    expect(markup).toContain("إجمالي شامل الضريبة");
    expect(markup).toContain("إعداد خطة مالية");
    expect(markup).toContain("50% عند التعميد");
  });

  it("يطبق هوية الشركة المخصصة على المستند الرسمي", () => {
    const markup = renderToStaticMarkup(<OfficialDocumentTemplate type="quotation" documentNumber="Q-2026-002" issueDate="2026-08-16" customer={{ name: "عميل" }} seller={{ legalNameAr: "الشركة" }} lines={[]} subtotal="0" taxTotal="0" grandTotal="0" branding={{ displayNameAr: "هوية تجريبية", displayNameEn: "QAYD", logoUrl: "https://cdn.example.com/logo.png", primaryColor: "#112233", accentColor: "#445566", surfaceColor: "#ddeeff" }} />);
    expect(markup).toContain("هوية تجريبية");
    expect(markup).toContain("QAYD");
    expect(markup).toContain("https://cdn.example.com/logo.png");
    expect(markup).toContain("#112233");
    expect(markup).toContain("#ddeeff");
  });

  it("يعرض رمز QR ضريبي في الفاتورة ويستخدم الأرقام الإنجليزية في المجاميع", () => {
    const markup = renderToStaticMarkup(<OfficialDocumentTemplate
      type="invoice"
      documentNumber="INV-2026-001"
      issueDate="2026-08-16T08:30:00.000Z"
      customer={{ name: "عميل اختباري" }}
      seller={{ legalNameAr: "شركة كونسيدرا القابضة", vatNumber: "314352144600003" }}
      lines={[{ description: "استشارة مالية", quantity: "1", unitPrice: "1000", lineTotal: "1000" }]}
      subtotal="1000"
      taxTotal="150"
      grandTotal="1150"
      status="issued"
    />);

    expect(markup).toContain('data-testid="zatca-qr-code"');
    expect(markup).toContain(money(1150));
    expect(markup).not.toContain("١١٥٠");
  });
});
