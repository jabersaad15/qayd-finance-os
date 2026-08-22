export function assertJournalMutable(status: string) {
  if (status !== "draft") throw new Error("لا يمكن تعديل قيد مرحّل أو ملغى؛ أنشئ قيد عكس عند الحاجة.");
}

export function assertAuditAppendOnly(operation: "insert" | "update" | "delete") {
  if (operation !== "insert") throw new Error("سجل التدقيق للقراءة والإضافة فقط؛ لا يسمح بالتعديل أو الحذف.");
}
