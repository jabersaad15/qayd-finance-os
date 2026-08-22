import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const accountTypes = [
  ["asset", "أصل"], ["liability", "التزام"], ["equity", "حقوق ملكية"], ["revenue", "إيراد"], ["cost_of_revenue", "تكلفة إيراد"], ["expense", "مصروف"], ["other_income", "دخل آخر"], ["other_expense", "مصروف آخر"],
] as const;

export default function AccountsManagement() {
  const workspaces = trpc.finance.listMyWorkspaces.useQuery();
  const workspace = workspaces.data?.find((item) => item.company) ?? workspaces.data?.[0];
  const tenantId = workspace?.tenant.id;
  const companyId = workspace?.company?.id;
  const enabled = Boolean(tenantId && companyId);
  const chart = trpc.finance.chartOfAccounts.useQuery({ tenantId: tenantId ?? 0, companyId: companyId ?? 0 }, { enabled });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [accountType, setAccountType] = useState<(typeof accountTypes)[number][0]>("asset");
  const [normalBalance, setNormalBalance] = useState<"debit" | "credit">("debit");
  const [parentId, setParentId] = useState("");
  const [isPosting, setIsPosting] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const reset = () => { setEditingId(null); setCode(""); setNameAr(""); setAccountType("asset"); setNormalBalance("debit"); setParentId(""); setIsPosting(true); setIsActive(true); };
  const refresh = () => { chart.refetch(); reset(); };
  const create = trpc.finance.createAccount.useMutation({ onSuccess: () => { toast.success("تمت إضافة الحساب إلى الدليل."); refresh(); }, onError: (error) => toast.error(error.message) });
  const update = trpc.finance.updateAccount.useMutation({ onSuccess: () => { toast.success("تم حفظ إعدادات الحساب."); refresh(); }, onError: (error) => toast.error(error.message) });
  const editing = chart.data?.find((item) => item.id === editingId);
  const parents = useMemo(() => (chart.data ?? []).filter((item) => item.accountType === accountType && item.id !== editingId), [chart.data, accountType, editingId]);
  const edit = (account: NonNullable<typeof chart.data>[number]) => { setEditingId(account.id); setCode(account.code); setNameAr(account.nameAr); setAccountType(account.accountType); setNormalBalance(account.normalBalance); setParentId(account.parentId ? String(account.parentId) : ""); setIsPosting(account.isPosting); setIsActive(account.isActive); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (!tenantId || !companyId) return; if (editing) update.mutate({ tenantId, companyId, accountId: editing.id, nameAr, parentId: parentId ? Number(parentId) : null, isPosting, isActive }); else create.mutate({ tenantId, companyId, code, nameAr, accountType, normalBalance, parentId: parentId ? Number(parentId) : undefined, isPosting }); };

  return <DashboardLayout><main className="min-h-full bg-[#f7f8f5] p-5 lg:p-8" dir="rtl"><div className="mx-auto max-w-6xl"><header className="mb-6"><p className="text-xs font-bold tracking-[0.18em] text-[#668076]">CHART OF ACCOUNTS</p><h1 className="mt-2 text-3xl font-bold text-[#163a35]">إدارة دليل الحسابات</h1><p className="mt-2 text-sm text-[#66756e]">أنشئ الحسابات وأدر علاقتها الهرمية وحالتها. يمنع الخادم الدورات وعدم توافق نوع الحساب مع الحساب الأب.</p></header>{!enabled ? <Card><CardContent className="p-7 text-center text-sm text-muted-foreground">أكمل إنشاء الشركة واختيار مساحة العمل قبل إدارة دليل الحسابات.</CardContent></Card> : <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]"><Card className="border-0 shadow-sm"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{editing ? `تعديل الحساب ${editing.code}` : "حساب جديد"}</CardTitle><CardDescription className="mt-1">لا يمكن تغيير الكود أو النوع بعد الإنشاء، للحفاظ على اتساق القيود المرتبطة.</CardDescription></div>{editing ? <Button size="sm" variant="outline" onClick={reset}>إلغاء</Button> : null}</div></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}>{!editing ? <><Label text="كود الحساب"><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} placeholder="1110" /></Label><Label text="نوع الحساب"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={accountType} onChange={(event) => setAccountType(event.target.value as typeof accountType)}>{accountTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Label><Label text="الرصيد الطبيعي"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={normalBalance} onChange={(event) => setNormalBalance(event.target.value as typeof normalBalance)}><option value="debit">مدين</option><option value="credit">دائن</option></select></Label></> : null}<Label text="اسم الحساب بالعربية"><Input value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder="أصول متداولة" /></Label><Label text="الحساب الأب"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">حساب رئيسي بلا أب</option>{parents.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.nameAr}</option>)}</select></Label><div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={isPosting} onChange={(event) => setIsPosting(event.target.checked)} />يسمح بالترحيل</label><label className="flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />نشط</label></div><Button type="submit" className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={!nameAr || (!editing && !code) || create.isPending || update.isPending}>{(create.isPending || update.isPending) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{editing ? "حفظ التعديل" : "إضافة الحساب"}</Button></form></CardContent></Card><Card className="border-0 shadow-sm"><CardHeader><div className="flex items-center justify-between"><div><CardTitle>حسابات الشركة</CardTitle><CardDescription className="mt-1">اختَر حساباً لتعديل اسمه أو الأب أو حالة الترحيل والتفعيل.</CardDescription></div><Badge variant="outline">{chart.data?.length ?? 0} حساب</Badge></div></CardHeader><CardContent>{chart.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#0b3d3a]" /> : <div className="divide-y rounded-lg border">{chart.data?.map((account) => <div className="flex items-center justify-between gap-3 p-3" key={account.id}><div><p className="font-medium text-[#203d36]">{account.nameAr} <span className="text-xs text-muted-foreground" dir="ltr">{account.code}</span></p><p className="mt-1 text-xs text-muted-foreground">{account.accountType} · {account.isPosting ? "قابل للترحيل" : "رئيسي"} · {account.isActive ? "نشط" : "متوقف"}</p></div><Button variant="outline" size="sm" onClick={() => edit(account)}>تعديل</Button></div>)}{!chart.data?.length ? <p className="p-6 text-center text-sm text-muted-foreground">لا توجد حسابات بعد؛ أكمل التهيئة أو أنشئ حساباً جديداً.</p> : null}</div>}</CardContent></Card></div>}</div></main></DashboardLayout>;
}

function Label({ text, children }: { text: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-[#40564d]"><span>{text}</span><div className="mt-2">{children}</div></label>; }
