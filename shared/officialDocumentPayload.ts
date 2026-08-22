import type { OfficialDocumentSeller } from "./officialDocumentPresentation";

type DateValue = Date | string | null | undefined;
type DocumentLine = { description: string; quantity: string; unitPrice: string; lineTotal: string };
type Customer = { name: string; vatNumber?: string | null };
type FinancialDocument = { issueDate: DateValue; scopeOfWork?: string | null; paymentTerms?: string | null; subtotal: string; taxTotal: string; grandTotal: string; status?: string | null };

export type OfficialDocumentPayload = { documentNumber: string; issueDate: string; expiryDate: string | null; customer: Customer; seller: OfficialDocumentSeller; scopeOfWork?: string | null; paymentTerms?: string | null; lines: DocumentLine[]; subtotal: string; taxTotal: string; grandTotal: string; status?: string | null };

const toIsoDate = (value: DateValue) => value ? new Date(value).toISOString() : new Date().toISOString();
const copyLines = (lines: DocumentLine[]) => lines.map((line) => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal }));

export function mapQuotationToOfficialDocument(source: { quotation: FinancialDocument & { quoteNumber: string; expiryDate?: DateValue }; customer: Customer; company: OfficialDocumentSeller; lines: DocumentLine[] }): OfficialDocumentPayload {
  return { documentNumber: source.quotation.quoteNumber, issueDate: toIsoDate(source.quotation.issueDate), expiryDate: source.quotation.expiryDate ? toIsoDate(source.quotation.expiryDate) : null, customer: source.customer, seller: source.company, scopeOfWork: source.quotation.scopeOfWork, paymentTerms: source.quotation.paymentTerms, lines: copyLines(source.lines), subtotal: source.quotation.subtotal, taxTotal: source.quotation.taxTotal, grandTotal: source.quotation.grandTotal, status: source.quotation.status };
}

export function mapInvoiceToOfficialDocument(source: { invoice: FinancialDocument & { invoiceNumber: string }; customer: Customer; company: OfficialDocumentSeller; lines: DocumentLine[] }): OfficialDocumentPayload {
  return { documentNumber: source.invoice.invoiceNumber, issueDate: toIsoDate(source.invoice.issueDate), expiryDate: null, customer: source.customer, seller: source.company, scopeOfWork: source.invoice.scopeOfWork, paymentTerms: source.invoice.paymentTerms, lines: copyLines(source.lines), subtotal: source.invoice.subtotal, taxTotal: source.invoice.taxTotal, grandTotal: source.invoice.grandTotal, status: source.invoice.status };
}
