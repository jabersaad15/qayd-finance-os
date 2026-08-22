import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function SalesCatalogQuickAdd({ tenantId, companyId }: { tenantId?: number; companyId?: number }) {
  const enabled = Boolean(tenantId && companyId);
  const input = { tenantId: tenantId ?? 0, companyId: companyId ?? 0 };
  const utils = trpc.useUtils();
  const assignees = trpc.sales.listSalesAssignees.useQuery(input, { enabled });
  const [customerName, setCustomerName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [salesOwnerUserId, setSalesOwnerUserId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const resetCustomer = () => { setCustomerName(""); setVatNumber(""); setContactName(""); setContactTitle(""); setContactEmail(""); setContactPhone(""); setSalesOwnerUserId(""); };
  const addCustomer = trpc.sales.createCustomer.useMutation({ onSuccess: async () => { resetCustomer(); toast.success("تمت إضافة العميل وجهة الاتصال المسؤولة."); await utils.sales.listCustomers.invalidate(input); }, onError: (error) => toast.error(error.message) });
  const addService = trpc.sales.createService.useMutation({ onSuccess: async () => { setServiceName(""); toast.success("تمت إضافة الخدمة بسعر يحدد عند الطلب."); await utils.sales.listServices.invalidate(input); }, onError: (error) => toast.error(error.message) });

  if (!enabled) return null;
  return <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]"><Card className="border-0 shadow-sm rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5 text-[#0b3d3a]" />عميل وجهة اتصال جديدة</CardTitle><p className="text-sm text-muted-foreground">احفظ الرقم الضريبي وبيانات مسؤول العميل وموظف المبيعات مالك العلاقة.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>اسم العميل أو المنشأة</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="اسم العميل" /></div><div className="space-y-2"><Label>الرقم الضريبي للعميل</Label><Input dir="ltr" value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} placeholder="15 رقماً عند توفره" /></div><div className="space-y-2"><Label>اسم جهة الاتصال</Label><Input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="الاسم المسؤول لدى العميل" /></div><div className="space-y-2"><Label>المسمى الوظيفي</Label><Input value={contactTitle} onChange={(event) => setContactTitle(event.target.value)} placeholder="مثل: المدير المالي" /></div><div className="space-y-2"><Label>بريد جهة الاتصال</Label><Input dir="ltr" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="client@example.com" /></div><div className="space-y-2"><Label>هاتف جهة الاتصال</Label><Input dir="ltr" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="05XXXXXXXX" /></div><div className="space-y-2 sm:col-span-2"><Label className="flex items-center gap-1"><UserRound className="h-4 w-4" />موظف المبيعات المسؤول</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={salesOwnerUserId} onChange={(event) => setSalesOwnerUserId(event.target.value)}><option value="">يُعين لاحقاً</option>{assignees.data?.map((member) => <option key={member.userId} value={member.userId}>{member.name || member.email || `موظف #${member.userId}`}</option>)}</select>{assignees.data?.length === 0 && <p className="text-xs text-muted-foreground">أضف عضواً بدور «المبيعات» من إدارة الفريق ليظهر هنا.</p>}</div><Button disabled={!customerName.trim() || addCustomer.isPending} onClick={() => addCustomer.mutate({ ...input, name: customerName.trim(), vatNumber: vatNumber.trim() || undefined, primaryContactName: contactName.trim() || undefined, primaryContactTitle: contactTitle.trim() || undefined, primaryContactEmail: contactEmail.trim() || undefined, primaryContactPhone: contactPhone.trim() || undefined, salesOwnerUserId: salesOwnerUserId ? Number(salesOwnerUserId) : undefined })} className="sm:col-span-2 bg-[#0b3d3a] hover:bg-[#082f2d]"><Plus className="ml-1 h-4 w-4" />حفظ العميل وجهة الاتصال</Button></CardContent></Card><Card className="border-0 shadow-sm rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-5 w-5 text-[#0b3d3a]" />خدمة بسعر عند الطلب</CardTitle></CardHeader><CardContent className="flex flex-col gap-3"><Input value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="اسم خدمة إضافية" /><Button disabled={!serviceName.trim() || addService.isPending} onClick={() => addService.mutate({ ...input, nameAr: serviceName.trim() })} className="bg-[#0b3d3a] hover:bg-[#082f2d]"><Plus className="ml-1 h-4 w-4" />إضافة خدمة</Button></CardContent></Card></section>;
}
