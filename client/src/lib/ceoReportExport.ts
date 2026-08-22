import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

type CeoExportData = {
  period: { from: string; to: string };
  metrics: Record<string, number | null>;
  departments: { sales: Record<string, number>; finance: Record<string, number>; operations: Record<string, number>; administration: Record<string, number> };
  traceability: Record<string, string>;
};

export function buildCeoExportRows(data: CeoExportData, exportedAt = new Date()) {
  const m = data.metrics;
  return [
    ["Executive Command Center", ""],
    ["تاريخ التصدير", exportedAt.toLocaleString("en-GB")],
    ["الفترة", `${data.period.from} — ${data.period.to}`],
    ["الإيرادات", m.revenue ?? "—"],
    ["صافي الربح من القيود المرحلة", m.netProfit ?? "—"],
    ["السيولة الداخلة", m.cashPosition ?? "—"],
    ["الذمم المدينة", m.receivables ?? "—"],
    ["قيمة خط المبيعات", m.pipelineValue ?? "—"],
    ["معدل التحصيل", m.collectionRate == null ? "—" : `${m.collectionRate.toFixed(1)}%`],
    ["المصروفات", m.expenses ?? "—"],
    ["المشكلات الحرجة", m.criticalIssues ?? "—"],
    ["المهام المتأخرة", m.overdueTasks ?? "—"],
    ["مصدر الإيرادات", data.traceability.revenue],
    ["مصدر صافي الربح", data.traceability.netProfit],
    ["مصدر خط المبيعات", data.traceability.pipelineValue],
  ] as Array<[string, string | number]>;
}

export function exportCeoReportToExcel(data: CeoExportData, filename = "qayd-executive-report.xlsx") {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(buildCeoExportRows(data));
  worksheet["!cols"] = [{ wch: 40 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Executive Report");
  XLSX.writeFile(workbook, filename);
}

export async function exportCeoReportToPdf(element: HTMLElement, filename = "qayd-executive-report.pdf") {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, ignoreElements: (node) => node.classList.contains("export-exclude") });
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const margin = 10; const pageWidth = 210 - margin * 2; const pageHeight = 297 - margin * 2; const imageHeight = (canvas.height * pageWidth) / canvas.width; const image = canvas.toDataURL("image/png");
  let offset = 0;
  while (offset < imageHeight) { if (offset > 0) pdf.addPage(); pdf.addImage(image, "PNG", margin, margin - offset, pageWidth, imageHeight); offset += pageHeight; }
  pdf.save(filename);
}
