import { getOfficialDocumentStatus, getOfficialSellerIdentity, type OfficialDocumentSeller } from "../../../shared/officialDocumentPresentation";
import { createZatcaTlvBase64 } from "../../../shared/zatcaQr";
import { ZatcaQrCode } from "./ZatcaQrCode";
import React from "react";
import { PRODUCT_BRAND } from "../../../shared/productBrand";

type LineItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

export type OfficialDocumentTemplateProps = {
  type: "quotation" | "invoice";
  documentNumber: string;
  issueDate: string;
  expiryDate?: string | null;
  customer: { name: string; vatNumber?: string | null };
  seller: OfficialDocumentSeller;
  scopeOfWork?: string | null;
  paymentTerms?: string | null;
  lines: LineItem[];
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  status?: string | null;
  onTaxQrReady?: (ready: boolean) => void;
  branding?: { displayNameAr?: string | null; displayNameEn?: string | null; logoUrl?: string | null; primaryColor?: string | null; accentColor?: string | null; surfaceColor?: string | null };
};

const formatAmount = (value: string) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value));

const dateOptions: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" };
const formatGregorianDate = (value: string) => new Intl.DateTimeFormat("en-GB", dateOptions).format(new Date(value));
const formatHijriDate = (value: string) => new Intl.DateTimeFormat("ar-SA-u-ca-islamic-nu-latn", dateOptions).format(new Date(value));
const letterheadUrl = import.meta.env.VITE_AUTH_MODE === "local"
  ? "/manus-storage/system/consedra-letterhead.png"
  : "/manus-storage/consedra-letterhead_3697738e.png";

export function OfficialDocumentTemplate({ type, documentNumber, issueDate, expiryDate, customer, seller, scopeOfWork, paymentTerms, lines, subtotal, taxTotal, grandTotal, status, onTaxQrReady, branding }: OfficialDocumentTemplateProps) {
  const isInvoice = type === "invoice";
  const title = isInvoice ? "فاتورة ضريبية" : "عرض سعر";
  const sellerIdentity = getOfficialSellerIdentity(seller);
  const statusLabel = getOfficialDocumentStatus(status);
  const brandPrimary = branding?.primaryColor || "#182a46";
  const brandAccent = branding?.accentColor || "#2f61a0";
  const brandSurface = branding?.surfaceColor || "#edf3fb";
  const brandLogo = branding?.logoUrl || "/manus-storage/consedra-logo-wide_562a1e92.jpg";
  const zatcaQrPayload = isInvoice && sellerIdentity.vatNumber
    ? createZatcaTlvBase64({ sellerName: sellerIdentity.legalNameAr, vatNumber: sellerIdentity.vatNumber, timestamp: issueDate, invoiceTotal: grandTotal, vatTotal: taxTotal })
    : null;

  return (
    <article
      className="consedra-document relative mx-auto min-h-[297mm] w-[210mm] max-w-full overflow-hidden bg-white text-[#192220] shadow-xl print:shadow-none"
      dir="rtl"
      style={{
        backgroundImage: `url('${letterheadUrl}')`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
      }}
    >
      <div className="relative z-10 px-[15mm] pb-[33mm] pt-[42mm]">
        <header className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: `${brandAccent}8c` }}>
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3"><img src={brandLogo} alt={branding?.displayNameAr || sellerIdentity.legalNameAr} className="h-10 max-w-[48mm] rounded bg-white object-contain p-1" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/manus-storage/consedra-logo-wide_562a1e92.jpg"; }} /><div><p className="text-[10px] font-medium tracking-[0.12em]" style={{ color: brandAccent }}>{branding?.displayNameEn || PRODUCT_BRAND.english}</p><p className="text-xs text-[#5c6470]">{branding?.displayNameAr || sellerIdentity.legalNameAr}</p></div></div>
            <h2 className="mt-1 text-2xl font-bold" style={{ color: brandPrimary }}>{title}</h2>
          </div>
          <div className="min-w-[42mm] space-y-1.5 rounded-md border border-[#d7e0ee] bg-white/90 px-3 py-2 text-[11px]">
            <div className="flex justify-between gap-3"><span className="text-[#5c6470]">رقم المستند</span><strong dir="ltr" className="text-[#182a46]">{documentNumber}</strong></div>
            <div className="space-y-1 border-t border-[#e4eaf2] pt-1.5"><div className="flex justify-between gap-3"><span className="text-[#5c6470]">تاريخ الإصدار (ميلادي)</span><span dir="ltr">{formatGregorianDate(issueDate)}</span></div><div className="flex justify-between gap-3"><span className="text-[#5c6470]">تاريخ الإصدار (هجري)</span><span>{formatHijriDate(issueDate)}</span></div></div>
            {expiryDate && <div className="space-y-1 border-t border-[#e4eaf2] pt-1.5"><div className="flex justify-between gap-3"><span className="text-[#5c6470]">صالح حتى (ميلادي)</span><span dir="ltr">{formatGregorianDate(expiryDate)}</span></div><div className="flex justify-between gap-3"><span className="text-[#5c6470]">صالح حتى (هجري)</span><span>{formatHijriDate(expiryDate)}</span></div></div>}
            {statusLabel && <div className="flex justify-between gap-3"><span className="text-[#5c6470]">الحالة</span><span className="font-medium text-[#182a46]">{statusLabel}</span></div>}
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 text-xs leading-6">
          <div className="rounded-md border border-[#d7e0ee] bg-white/88 p-3">
            <p className="font-bold text-[#182a46]">بيانات العميل</p>
            <p className="mt-1 font-medium text-[#1f2933]">{customer.name}</p>
            {customer.vatNumber && <p className="text-[#58616c]">الرقم الضريبي: <span dir="ltr">{customer.vatNumber}</span></p>}
          </div>
          <div className="rounded-md border border-[#d7e0ee] bg-white/88 p-3">
            <p className="font-bold text-[#182a46]">بيانات البائع</p>
            <p className="mt-1 font-medium text-[#1f2933]">{sellerIdentity.legalNameAr}</p>
            {sellerIdentity.vatNumber && <p className="text-[#58616c]">الرقم الضريبي: <span dir="ltr">{sellerIdentity.vatNumber}</span></p>}
            {sellerIdentity.registrationNumber && <p className="text-[#58616c]">السجل/الرقم الموحد: <span dir="ltr">{sellerIdentity.registrationNumber}</span></p>}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-md border border-[#bfcde0] bg-white/92">
          <table className="w-full border-collapse text-right text-[11px]">
            <thead className="text-white" style={{ backgroundColor: brandPrimary }}>
              <tr>
                <th className="px-3 py-2 text-right font-medium">الخدمة / البيان</th>
                <th className="w-[15mm] px-2 py-2 text-center font-medium">الكمية</th>
                <th className="w-[31mm] px-2 py-2 text-left font-medium">سعر الوحدة</th>
                <th className="w-[34mm] px-3 py-2 text-left font-medium">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => <tr key={`${line.description}-${index}`} className="border-t border-[#dce4ee] odd:bg-[#f9fbfe]">
                <td className="px-3 py-2.5 align-top font-medium text-[#26323f]">{line.description}</td>
                <td className="px-2 py-2.5 text-center" dir="ltr">{line.quantity}</td>
                <td className="px-2 py-2.5 text-left" dir="ltr">{formatAmount(line.unitPrice)}</td>
                <td className="px-3 py-2.5 text-left font-medium" dir="ltr">{formatAmount(line.lineTotal)}</td>
              </tr>)}
            </tbody>
          </table>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 text-xs leading-6">
          <div className="rounded-md border border-[#d7e0ee] bg-white/88 p-3">
            <p className="font-bold text-[#182a46]">نطاق العمل</p>
            <p className="mt-1 whitespace-pre-line text-[#58616c]">{scopeOfWork || "لم يُسجَّل نطاق عمل إضافي؛ ويقتصر النطاق على البنود التفصيلية الواردة في هذا المستند."}</p>
          </div>
          <div className="rounded-md border border-[#d7e0ee] bg-white/88 p-3">
            <p className="font-bold text-[#182a46]">الشروط التجارية</p>
            <p className="mt-1 whitespace-pre-line text-[#58616c]">{paymentTerms || (isInvoice ? "لم تُسجَّل شروط سداد إضافية لهذه الفاتورة." : expiryDate ? "صلاحية العرض موضحة في رأس المستند." : "لم تُسجَّل شروط سداد أو صلاحية إضافية لهذا العرض.")}</p>
          </div>
        </section>

        <section className="mt-4 flex items-end justify-between gap-4">
          {zatcaQrPayload ? <ZatcaQrCode payload={zatcaQrPayload} onReady={onTaxQrReady} /> : <p className="max-w-[55mm] rounded-md border border-amber-300 bg-amber-50 p-2 text-[10px] leading-5 text-amber-900">لا يمكن إنشاء رمز QR الضريبي قبل إدخال الرقم الضريبي للبائع في إعدادات الشركة.</p>}
          <div className="w-[75mm] overflow-hidden rounded-md border border-[#bfcde0] bg-white/92 text-xs">
            <div className="flex justify-between border-b border-[#dce4ee] px-3 py-2"><span>الإجمالي قبل الضريبة</span><strong dir="ltr">{formatAmount(subtotal)}</strong></div>
            <div className="flex justify-between border-b border-[#dce4ee] px-3 py-2"><span>ضريبة القيمة المضافة</span><strong dir="ltr">{formatAmount(taxTotal)}</strong></div>
            <div className="flex justify-between px-3 py-2.5 text-sm" style={{ backgroundColor: brandSurface, color: brandPrimary }}><strong>الإجمالي شامل الضريبة</strong><strong dir="ltr">{formatAmount(grandTotal)}</strong></div>
          </div>
        </section>

        <footer className="mt-7 border-t border-[#2f61a0]/55 pt-3 text-[10px] leading-5 text-[#53616e]">
          <p>{isInvoice ? "هذه الفاتورة صادرة من النظام المالي للشركة. يرجى مراجعة بياناتها قبل اعتمادها أو مشاركتها." : "يُرجى اعتماد نطاق العمل والشروط التجارية الواردة في هذا العرض قبل البدء بالتنفيذ."}</p>
          {sellerIdentity.nationalAddress && <p className="mt-1">العنوان الوطني: <span dir="ltr">{sellerIdentity.nationalAddress}</span></p>}
        </footer>
      </div>
    </article>
  );
}
