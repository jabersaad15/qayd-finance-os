import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function CustomerPortalManager({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const enabled = Boolean(tenantId && companyId);
  const scope = { tenantId: tenantId ?? 0, companyId: companyId ?? 0 };
  const customers = trpc.sales.listCustomers.useQuery(scope, { enabled });
  const [customerId, setCustomerId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const createLink = trpc.customerPortal.createAccessLink.useMutation({ onSuccess: async (result) => { const link = `${window.location.origin}${result.path}`; setCreatedLink(link); await navigator.clipboard?.writeText(link); toast.success("تم إنشاء رابط بوابة العميل ونسخه."); }, onError: (error) => toast.error(error.message) });
  if (!enabled) return null;
  return <Card className="rounded-2xl border border-[#d6e3d8] shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#0b3d3a]"><ShieldCheck className="h-5 w-5" />بوابة العميل</CardTitle><p className="text-sm text-muted-foreground">أنشئ رابطاً مؤقتاً وآمناً يتيح للعميل متابعة عروض الأسعار والفواتير وحالة السداد.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-[1fr_160px_auto]"><div className="space-y-2"><Label>العميل</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">اختر العميل</option>{customers.data?.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div><div className="space-y-2"><Label>الصلاحية بالأيام</Label><Input dir="ltr" inputMode="numeric" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} /></div><div className="flex items-end"><Button className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={!customerId || createLink.isPending} onClick={() => createLink.mutate({ ...scope, customerId: Number(customerId), expiresInDays: Number(expiresInDays) })}>{createLink.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Link2 className="ml-2 h-4 w-4" />}إنشاء الرابط</Button></div></div>{createdLink && <div className="rounded-xl border border-[#b7d8c5] bg-[#f3faf5] p-3"><p className="mb-2 text-xs font-semibold text-[#0b3d3a]">الرابط جاهز وتم نسخه للحافظة</p><Input dir="ltr" readOnly value={createdLink} className="bg-white text-xs" /></div>}</CardContent></Card>;
}
