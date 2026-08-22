import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

const labels: Record<string, string> = { login_success: "دخول ناجح", login_failed: "محاولة دخول فاشلة", logout: "تسجيل خروج", password_changed: "تغيير كلمة المرور", session_revoked: "إلغاء جلسة", portal_access: "وصول بوابة" };
export function SecurityEventsPanel() {
  const events = trpc.security.myEvents.useQuery({ limit: 20 });
  return <Card className="rounded-2xl border border-[#d6e3d8] shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#0b3d3a]"><ShieldCheck className="h-5 w-5" />سجل الأمان الشخصي</CardTitle><p className="text-sm text-muted-foreground">آخر عمليات الدخول وتغييرات الأمان المرتبطة بحسابك.</p></CardHeader><CardContent>{events.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : events.error ? <p className="text-sm text-red-700">تعذر تحميل سجل الأمان.</p> : events.data?.length ? <div className="space-y-2">{events.data.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"><div className="flex items-center gap-2">{event.eventType === "login_failed" ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <ShieldCheck className="h-4 w-4 text-emerald-700" />}<span>{labels[event.eventType] ?? event.eventType}</span></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span dir="ltr">{event.ipAddress ?? "—"}</span><span dir="ltr">{new Date(event.createdAt).toLocaleString("en-US")}</span><Badge variant="outline">{event.eventType === "login_failed" ? "راجع الحساب" : "مسجل"}</Badge></div></div>)}</div> : <p className="rounded-xl bg-[#f7f9f7] p-4 text-sm text-muted-foreground">لا توجد أحداث أمان مسجلة بعد.</p>}</CardContent></Card>;
}
