import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { deriveAccountantDashboardState } from "../../../shared/accountantDashboardState";
import type { AccountantDateRange } from "../../../shared/accountantDashboardState";

type AccountantState = ReturnType<typeof deriveAccountantDashboardState>;

export function buildAccountantExportRows(state: AccountantState, exportedAt = new Date(), range: AccountantDateRange = {}) {
  return [
    ["تقرير لوحة المحاسب", ""],
    ["تاريخ التصدير", exportedAt.toLocaleString("en-GB")],
    ["الفترة المحددة", range.startDate || range.endDate ? `${range.startDate || "بداية السجل"} — ${range.endDate || "حتى الآن"}` : "كل الفترات"],
    ["مراجعة الموردين", state.pendingSupplier],
    ["مسودات الموردين", state.draftSupplier],
    ["ملفات VAT تحت المراجعة", state.preparedVat],
    ["ملفات VAT المراجعة", state.reviewedVat],
    ["فحوص الامتثال الحرجة", state.reviewCount],
    ["طابور الامتثال", state.queuedCompliance],
    ["إجمالي المدين", state.debit],
    ["إجمالي الدائن", state.credit],
    ["حالة ميزان المراجعة", state.balanced ? "متوازن" : "يتطلب مراجعة"],
  ] as Array<[string, string | number]>;
}

export function exportAccountantReportToExcel(state: AccountantState, filename = "accountant-dashboard-report.xlsx", range: AccountantDateRange = {}) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(buildAccountantExportRows(state, new Date(), range));
  worksheet["!cols"] = [{ wch: 32 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "لوحة المحاسب");
  XLSX.writeFile(workbook, filename);
}

export async function exportAccountantReportToPdf(element: HTMLElement, filename = "accountant-dashboard-report.pdf") {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, ignoreElements: (node) => node.classList.contains("export-exclude") });
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = 210 - margin * 2;
  const pageHeight = 297 - margin * 2;
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  const image = canvas.toDataURL("image/png");
  let offset = 0;
  while (offset < imageHeight) {
    if (offset > 0) pdf.addPage();
    pdf.addImage(image, "PNG", margin, margin - offset, pageWidth, imageHeight);
    offset += pageHeight;
  }
  pdf.save(filename);
}
