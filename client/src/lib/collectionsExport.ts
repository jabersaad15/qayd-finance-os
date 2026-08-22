import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

export type CollectionsExportInvoice = {
  invoiceNumber: string;
  customerName: string;
  salesOwnerName: string | null;
  grandTotal: string;
  paidTotal: string;
  outstanding: string;
  dueDate: Date | string | null;
  paymentStatus: string;
};

export type CollectionsExportData = {
  totalInvoiced: string;
  totalPaid: string;
  remainingBalance: string;
  overdue: CollectionsExportInvoice[];
  invoices: CollectionsExportInvoice[];
};

export type CollectionsExportRange = { startDate?: string; endDate?: string };

const dateValue = (value: Date | string | null) => value ? new Date(value).toISOString().slice(0, 10) : "بدون تاريخ";
const moneyValue = (value: string) => Number(value).toFixed(2);
const statusLabel: Record<string, string> = { overdue: "متأخرة", upcoming: "قريبة الاستحقاق", pending: "قيد المتابعة", partially_paid: "مدفوعة جزئياً", paid: "مدفوعة" };

export function buildCollectionsSummaryRows(data: CollectionsExportData, exportedAt = new Date(), range: CollectionsExportRange = {}) {
  return [
    ["تقرير التحصيلات الموحد", ""],
    ["تاريخ التصدير", exportedAt.toLocaleString("en-GB")],
    ["الفترة", range.startDate || range.endDate ? `${range.startDate || "بداية السجل"} — ${range.endDate || "حتى الآن"}` : "كل الفترات"],
    ["إجمالي الفواتير المعروضة", moneyValue(data.totalInvoiced)],
    ["إجمالي المحصل", moneyValue(data.totalPaid)],
    ["الرصيد المتبقي", moneyValue(data.remainingBalance)],
    ["عدد الفواتير المتأخرة", data.overdue.length],
  ] as Array<[string, string | number]>;
}

export function buildCollectionsInvoiceRows(invoices: CollectionsExportInvoice[]) {
  return invoices.map((invoice) => ({ "رقم الفاتورة": invoice.invoiceNumber, "اسم العميل": invoice.customerName, "مسؤول المبيعات": invoice.salesOwnerName || "غير معين", "إجمالي الفاتورة (SAR)": moneyValue(invoice.grandTotal), "المحصل (SAR)": moneyValue(invoice.paidTotal), "المتبقي (SAR)": moneyValue(invoice.outstanding), "تاريخ الاستحقاق": dateValue(invoice.dueDate), "الحالة": statusLabel[invoice.paymentStatus] || invoice.paymentStatus }));
}

export function exportCollectionsBoardToExcel(data: CollectionsExportData, filename = "collections-board-report.xlsx", range: CollectionsExportRange = {}) {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet(buildCollectionsSummaryRows(data, new Date(), range));
  summary["!cols"] = [{ wch: 32 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, summary, "ملخص التحصيلات");
  const overdue = XLSX.utils.json_to_sheet(buildCollectionsInvoiceRows(data.overdue));
  overdue["!cols"] = Array.from({ length: 8 }, () => ({ wch: 23 }));
  XLSX.utils.book_append_sheet(workbook, overdue, "الفواتير المتأخرة");
  const allInvoices = XLSX.utils.json_to_sheet(buildCollectionsInvoiceRows(data.invoices));
  allInvoices["!cols"] = Array.from({ length: 8 }, () => ({ wch: 23 }));
  XLSX.utils.book_append_sheet(workbook, allInvoices, "كل الفواتير");
  XLSX.writeFile(workbook, filename);
}

export async function exportCollectionsBoardToPdf(element: HTMLElement, filename = "collections-board-report.pdf") {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, ignoreElements: (node) => node.classList.contains("export-exclude") });
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const margin = 10; const pageWidth = 210 - margin * 2; const pageHeight = 297 - margin * 2; const imageHeight = (canvas.height * pageWidth) / canvas.width; const image = canvas.toDataURL("image/png");
  let offset = 0;
  while (offset < imageHeight) { if (offset > 0) pdf.addPage(); pdf.addImage(image, "PNG", margin, margin - offset, pageWidth, imageHeight); offset += pageHeight; }
  pdf.save(filename);
}
