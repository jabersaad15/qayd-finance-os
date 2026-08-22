import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

export type SalesPerformanceExportData = {
  totalOpportunities: number;
  totalExpectedValue: string;
  totalWeightedValue: string;
  transitions: Array<{ fromLabel: string; toLabel: string | null; entered: number; advanced: number; conversionRate: number }>;
  reps: Array<{ name: string; email: string; opportunities: number; won: number; lost: number; winRate: number; expectedValue: string; weightedValue: string; activities: number; completedActivities: number; overdueActivities: number; activityCompletionRate: number }>;
};

export type SalesPerformanceExportRange = { startDate?: string; endDate?: string };

export function buildSalesPerformanceSummaryRows(data: SalesPerformanceExportData, exportedAt = new Date(), range: SalesPerformanceExportRange = {}) {
  return [
    ["تقرير أداء المبيعات", ""],
    ["تاريخ التصدير", exportedAt.toLocaleString("en-GB")],
    ["الفترة", range.startDate || range.endDate ? `${range.startDate || "بداية السجل"} — ${range.endDate || "حتى الآن"}` : "كل الفترات"],
    ["إجمالي الفرص", data.totalOpportunities],
    ["القيمة المتوقعة (SAR)", Number(data.totalExpectedValue).toFixed(2)],
    ["القيمة المرجحة (SAR)", Number(data.totalWeightedValue).toFixed(2)],
  ] as Array<[string, string | number]>;
}

export function exportSalesPerformanceToExcel(data: SalesPerformanceExportData, filename = "sales-performance-report.xlsx", range: SalesPerformanceExportRange = {}) {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet(buildSalesPerformanceSummaryRows(data, new Date(), range));
  summary["!cols"] = [{ wch: 32 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(workbook, summary, "ملخص الأداء");
  const funnel = XLSX.utils.json_to_sheet(data.transitions.map((item) => ({ "من المرحلة": item.fromLabel, "إلى المرحلة": item.toLabel || "نهاية المسار", "عدد الدخول": item.entered, "عدد الانتقال": item.advanced, "معدل التحويل %": item.conversionRate })));
  funnel["!cols"] = Array.from({ length: 5 }, () => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(workbook, funnel, "قمع التحويل");
  const reps = XLSX.utils.json_to_sheet(data.reps.map((rep) => ({ "ممثل المبيعات": rep.name, "البريد": rep.email, "الفرص": rep.opportunities, "الفوز": rep.won, "الخسارة": rep.lost, "معدل الفوز %": rep.winRate, "القيمة المتوقعة SAR": Number(rep.expectedValue).toFixed(2), "القيمة المرجحة SAR": Number(rep.weightedValue).toFixed(2), "الأنشطة": rep.activities, "الأنشطة المنجزة": rep.completedActivities, "المتابعات المتأخرة": rep.overdueActivities, "إنجاز المتابعات %": rep.activityCompletionRate })));
  reps["!cols"] = Array.from({ length: 12 }, () => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(workbook, reps, "أداء ممثلي المبيعات");
  XLSX.writeFile(workbook, filename);
}

export async function exportSalesPerformanceToPdf(element: HTMLElement, filename = "sales-performance-report.pdf") {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, ignoreElements: (node) => node.classList.contains("export-exclude") });
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const margin = 10; const pageWidth = 210 - margin * 2; const pageHeight = 297 - margin * 2; const imageHeight = (canvas.height * pageWidth) / canvas.width; const image = canvas.toDataURL("image/png");
  let offset = 0;
  while (offset < imageHeight) { if (offset > 0) pdf.addPage(); pdf.addImage(image, "PNG", margin, margin - offset, pageWidth, imageHeight); offset += pageHeight; }
  pdf.save(filename);
}
