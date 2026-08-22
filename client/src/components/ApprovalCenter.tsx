import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock3, FileCheck2, Info, Loader2, Paperclip, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const inboxFilters = [["all", "الكل"], ["new", "New"], ["due_today", "Due Today"], ["overdue", "Overdue"], ["high_value", "High Value"], ["critical", "Critical"]] as const;

const tabs = [
  ["pending", "Pending My Approval"],
  ["mine", "My Requests"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["returned", "Returned"],
  ["completed", "Completed"],
] as const;

const statusLabels: Record<string, string> = { pending: "معلق", approved: "معتمد", rejected: "مرفوض", returned: "معاد للتعديل", information_required: "يحتاج معلومات", completed: "مكتمل" };

export function ApprovalCenter({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const enabled = Boolean(tenantId && companyId);
  const input = { tenantId: tenantId ?? 0, companyId: companyId ?? 0 };
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("pending");
  const [inboxFilter, setInboxFilter] = useState<(typeof inboxFilters)[number][0]>("all");
  const [note, setNote] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const utils = trpc.useUtils();
  const center = trpc.approvals.centralList.useQuery({ ...input, tab: tab as "pending" | "mine" | "approved" | "rejected" | "returned" | "completed", inboxFilter: inboxFilter as "all" | "new" | "due_today" | "overdue" | "high_value" | "critical" }, { enabled });
  const legacyPending = trpc.approvals.listPending.useQuery(input, { enabled });
  const upload = trpc.approvals.centralUploadAttachment.useMutation({ onSuccess: () => { toast.success("تم رفع المرفق وتسجيله في سجل التدقيق."); setAttachment(null); }, onError: (error) => toast.error(error.message) });
  const uploadAttachment = (caseId: number) => { if (!attachment) return; const reader = new FileReader(); reader.onload = () => { const raw = String(reader.result ?? "").split(",").pop() ?? ""; upload.mutate({ ...input, caseId, fileName: attachment.name, mimeType: attachment.type as "application/pdf" | "image/png" | "image/jpeg" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileSize: attachment.size, dataBase64: raw }); }; reader.readAsDataURL(attachment); };
  const act = trpc.approvals.centralAct.useMutation({ onSuccess: async () => { toast.success("تم تسجيل الإجراء في سجل التدقيق."); setNote(""); await utils.approvals.centralList.invalidate(); }, onError: (error) => toast.error(error.message) });
  const decide = trpc.approvals.decide.useMutation({ onSuccess: async () => { toast.success("تم تسجيل القرار في سجل التدقيق."); setNote(""); await legacyPending.refetch(); }, onError: (error) => toast.error(error.message) });
  if (!enabled) return null;

  return <Card className="rounded-2xl border border-[#d6e3d8] shadow-sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base text-[#0b3d3a]"><Clock3 className="h-5 w-5" />Approval Center المركزي</CardTitle>
      <p className="text-sm text-muted-foreground">مركز موحد للطلبات مع عزل الشركة، منع الاعتماد الذاتي، وسجل تدقيق لكل إجراء.</p>
      <div className="flex flex-wrap gap-2 pt-3">{tabs.map(([value, label]) => <Button key={value} size="sm" variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)}>{label}</Button>)}      </div><div className="flex flex-wrap gap-2 pt-2">{inboxFilters.map(([value, label]) => <Button key={value} size="sm" variant={inboxFilter === value ? "default" : "outline"} onClick={() => setInboxFilter(value)}>{label}</Button>)}</div>
    </CardHeader>
    <CardContent className="space-y-4">
      {center.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : center.error ? <p className="rounded-xl bg-[#fff5f2] p-4 text-sm text-[#8b4337]">{center.error.message}</p> : center.data?.length ? center.data.map((item) => <div key={item.id} className="rounded-xl border border-[#e2e9e3] bg-[#fbfdfb] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#263b32]">{item.requestType} · {item.requestNumber}</p><p className="mt-1 text-xs text-muted-foreground">{item.module} · {item.entityType} · <span dir="ltr">{item.amount} {item.currency}</span></p></div><Badge variant="outline">{statusLabels[item.status] ?? item.status}</Badge></div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
        <div className="mt-3 grid gap-2 text-xs text-[#66756d] sm:grid-cols-3"><span>مقدم الطلب: #{item.requestedByUserId}</span><span>المرحلة الحالية: {item.currentStep}</span><span>الأولوية: {item.priority}</span><span>النمط: {item.workflowMode === "parallel" ? "متوازٍ" : "تتابعي"}</span><span>القسم: {item.department || "غير محدد"}</span><span>{item.dueAt ? (new Date(item.dueAt).getTime() < Date.now() ? "Overdue" : `Time Remaining: ${Math.max(0, Math.ceil((new Date(item.dueAt).getTime() - Date.now()) / 3600000))}h`) : "SLA غير محدد"}</span></div>{item.actions.length > 0 && <div className="mt-3 rounded-lg bg-white p-3 text-xs text-[#627168]"><p className="font-semibold text-[#30463a]">Approval Timeline</p>{item.actions.map((action) => <p key={action.id} className="mt-1" dir="ltr">{new Date(action.createdAt).toLocaleString("en-CA")} · {action.action} · user #{action.actorUserId}{action.note ? ` · ${action.note}` : ""}</p>)}</div>}{item.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.attachments.map((attachment) => <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#eef7ef] px-3 py-2 text-xs text-[#17613a] underline">{attachment.fileName}</a>)}</div>}
        {tab === "pending" && <><Textarea className="mt-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة الإجراء؛ سبب الرفض إلزامي" /><div className="mt-3 flex flex-wrap items-center gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#b9cdbd] px-3 py-2 text-xs text-[#587064]"><Paperclip className="h-4 w-4" /><span>{attachment ? attachment.name : "إرفاق مستند"}</span><input type="file" className="hidden" accept="application/pdf,image/png,image/jpeg,.xlsx,.docx" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></label>{attachment && <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => uploadAttachment(item.id)}>رفع المرفق</Button>}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" className="bg-[#177245] hover:bg-[#125b37]" disabled={act.isPending} onClick={() => act.mutate({ ...input, caseId: item.id, action: "approve", note: note.trim() || undefined })}><CheckCircle2 className="ml-1 h-4 w-4" />اعتماد</Button><Button size="sm" variant="outline" className="border-red-200 text-red-700" disabled={act.isPending || !note.trim()} onClick={() => act.mutate({ ...input, caseId: item.id, action: "reject", note: note.trim() })}><XCircle className="ml-1 h-4 w-4" />رفض</Button><Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ ...input, caseId: item.id, action: "return", note: note.trim() || undefined })}><RotateCcw className="ml-1 h-4 w-4" />Return for Changes</Button><Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ ...input, caseId: item.id, action: "request_information", note: note.trim() || undefined })}><Info className="ml-1 h-4 w-4" />Request More Information</Button></div></>}
      </div>) : <p className="rounded-xl bg-[#f7f9f7] p-4 text-sm text-muted-foreground">لا توجد طلبات في هذا التبويب.</p>}
      <details className="rounded-xl border border-[#e2e9e3] p-3"><summary className="cursor-pointer text-sm font-semibold text-[#30463a]">الطلبات القديمة المرتبطة بالمستندات</summary><div className="mt-3 space-y-2">{legacyPending.data?.length ? legacyPending.data.map((request) => <div key={request.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{request.documentType} #{request.documentId}</span><Badge variant="outline">معلق</Badge></div><p className="mt-1 text-xs text-muted-foreground">المبلغ: <span dir="ltr">{request.amount} SAR</span></p><Textarea className="mt-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة القرار" /><div className="mt-2 flex gap-2"><Button size="sm" onClick={() => decide.mutate({ ...input, requestId: request.id, decision: "approved", note: note.trim() || undefined })}>اعتماد</Button><Button size="sm" variant="outline" disabled={!note.trim()} onClick={() => decide.mutate({ ...input, requestId: request.id, decision: "rejected", note: note.trim() })}>رفض</Button></div></div>) : <p className="text-sm text-muted-foreground">لا توجد طلبات قديمة معلقة.</p>}</div></details>
      <div className="flex items-center gap-2 rounded-xl bg-[#f5f8f5] p-3 text-xs leading-6 text-[#587064]"><FileCheck2 className="h-4 w-4 shrink-0 text-[#0b3d3a]" />المصفوفة المركزية تدعم مسارات تتابعية أو متوازية، وأي واحد أو اعتماد الجميع، بينما تبقى Step-Up Authentication إعداداً قابلاً للتفعيل ولا تُدّعى فعاليته قبل الربط.</div>
    </CardContent>
  </Card>;
}
