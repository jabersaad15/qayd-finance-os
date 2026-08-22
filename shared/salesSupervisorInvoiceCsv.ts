export function buildSalesSupervisorInvoiceCsv(invoices: Array<{ invoiceNumber: string; status: string; issueDate: Date | string; dueDate: Date | string | null; grandTotal: string }>) {
  const header = "invoiceNumber,status,issueDate,dueDate,grandTotal";
  const rows = invoices.map((invoice) => [invoice.invoiceNumber, invoice.status, new Date(invoice.issueDate).toISOString().slice(0, 10), invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : "—", invoice.grandTotal].map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","));
  return `${header}\n${rows.join("\n")}`;
}
