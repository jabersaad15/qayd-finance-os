import { useEffect, useState } from "react";
import { Palette, Save, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_BRAND } from "../../../shared/productBrand";

const DEFAULT_LOGO = "/manus-storage/consedra-logo-wide_562a1e92.jpg";
const DEFAULT_FAVICON = "/manus-storage/consedra-logo-square_12f98105.jpg";

export function BrandingSettings({ tenantId, companyId, roleCode }: { tenantId?: number; companyId?: number; roleCode?: string }) {
  const enabled = Boolean(tenantId && companyId);
  const canEdit = ["company_admin", "super_admin", "general_manager"].includes(roleCode ?? "");
  const branding = trpc.finance.getCompanyBranding.useQuery({ tenantId: tenantId ?? 0, companyId: companyId ?? 0 }, { enabled });
  const save = trpc.finance.saveCompanyBranding.useMutation({ onSuccess: () => { toast.success("تم حفظ هوية الشركة."); branding.refetch(); }, onError: (error) => toast.error(error.message) });
  const uploadAsset = trpc.finance.uploadCompanyBrandingAsset.useMutation({ onSuccess: (result) => { if (result.kind === "logo") setLogoUrl(result.url); else setFaviconUrl(result.url); toast.success("تم رفع الملف، اضغط حفظ الهوية لاعتماده."); }, onError: (error) => toast.error(error.message) });
  const [displayNameAr, setDisplayNameAr] = useState("");
  const [displayNameEn, setDisplayNameEn] = useState("");
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);
  const [faviconUrl, setFaviconUrl] = useState(DEFAULT_FAVICON);
  const [primaryColor, setPrimaryColor] = useState("#0B3D3A");
  const [accentColor, setAccentColor] = useState("#4A82C4");
  const [surfaceColor, setSurfaceColor] = useState("#F6F7F4");

  useEffect(() => {
    if (!branding.data) return;
    setDisplayNameAr(branding.data.displayNameAr ?? "");
    setDisplayNameEn(branding.data.displayNameEn ?? "");
    setLogoUrl(branding.data.logoUrl ?? DEFAULT_LOGO);
    setFaviconUrl(branding.data.faviconUrl ?? DEFAULT_FAVICON);
    setPrimaryColor(branding.data.primaryColor ?? "#0B3D3A");
    setAccentColor(branding.data.accentColor ?? "#4A82C4");
    setSurfaceColor(branding.data.surfaceColor ?? "#F6F7F4");
  }, [branding.data]);

  if (!enabled) return null;
  const previewName = displayNameAr || displayNameEn || "اسم شركتك";
  const submit = () => save.mutate({ tenantId: tenantId!, companyId: companyId!, displayNameAr: displayNameAr || undefined, displayNameEn: displayNameEn || undefined, logoUrl: logoUrl || undefined, faviconUrl: faviconUrl || undefined, primaryColor, accentColor, surfaceColor });
  const onAssetSelected = (event: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "favicon") => { const file = event.target.files?.[0]; if (!file || !tenantId || !companyId) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast.error("اختر ملف PNG أو JPG أو WEBP فقط."); event.target.value = ""; return; } if (file.size > 5 * 1024 * 1024) { toast.error("حجم الملف يجب ألا يتجاوز 5 ميغابايت."); event.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => { const result = reader.result; if (typeof result === "string") uploadAsset.mutate({ tenantId, companyId, kind, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", dataBase64: result.split(",")[1] ?? "" }); }; reader.readAsDataURL(file); };

  return <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]" dir="rtl">
    <Card className="rounded-2xl border-0 shadow-sm">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-5 w-5 text-[#0b3d3a]" />هوية الشركة</CardTitle><p className="text-sm text-muted-foreground">خصص الاسم والشعار والألوان التي تظهر لفريقك وعملائك داخل النظام.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>اسم الشركة بالعربية</Label><Input value={displayNameAr} onChange={(e) => setDisplayNameAr(e.target.value)} disabled={!canEdit} /></div><div className="space-y-2"><Label>اسم الشركة بالإنجليزية</Label><Input value={displayNameEn} onChange={(e) => setDisplayNameEn(e.target.value)} dir="ltr" disabled={!canEdit} /></div></div>
        <div className="space-y-2"><Label>الشعار الرئيسي</Label><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onAssetSelected(e, "logo")} disabled={!canEdit || uploadAsset.isPending} /><p className="text-xs text-muted-foreground">PNG أو JPG أو WEBP، بحد أقصى 5 ميغابايت. سيظهر الشعار في المعاينة بعد الرفع.</p></div>
        <div className="space-y-2"><Label>أيقونة الموقع</Label><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onAssetSelected(e, "favicon")} disabled={!canEdit || uploadAsset.isPending} /><p className="text-xs text-muted-foreground">يفضل استخدام صورة مربعة واضحة للأيقونة.</p></div>
        <div className="grid gap-3 sm:grid-cols-3">{[["اللون الرئيسي", primaryColor, setPrimaryColor], ["لون التمييز", accentColor, setAccentColor], ["لون الخلفية", surfaceColor, setSurfaceColor]].map(([label, value, setter]) => <div className="space-y-2" key={label as string}><Label>{label as string}</Label><div className="flex items-center gap-2"><input type="color" className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1" value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} disabled={!canEdit} /><Input value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} dir="ltr" disabled={!canEdit} /></div></div>)}</div>
        {canEdit ? <Button className="w-full bg-[#0b3d3a] hover:bg-[#082f2d]" disabled={save.isPending} onClick={submit}>{save.isPending ? <Upload className="ml-2 h-4 w-4 animate-pulse" /> : <Save className="ml-2 h-4 w-4" />}حفظ الهوية</Button> : <p className="rounded-xl bg-[#f7f9f7] p-3 text-sm text-muted-foreground">تعديل الهوية متاح لمسؤول الشركة والإدارة العليا فقط.</p>}
      </CardContent>
    </Card>
    <Card className="overflow-hidden rounded-2xl border-0 shadow-sm" style={{ backgroundColor: surfaceColor }}>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Eye className="h-5 w-5" style={{ color: primaryColor }} />معاينة الهوية</CardTitle></CardHeader>
      <CardContent><div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center gap-3 p-4" style={{ backgroundColor: primaryColor, color: "#fff" }}><img src={logoUrl || DEFAULT_LOGO} alt={previewName} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_LOGO; }} className="h-10 w-28 shrink-0 rounded-md bg-white object-contain p-1 sm:h-11 sm:w-32" /><div className="min-w-0"><p className="truncate font-bold">{previewName}</p><p className="text-xs opacity-75">{PRODUCT_BRAND.bilingual}</p></div></div><div className="grid gap-2 p-3 sm:gap-3 sm:p-5 sm:grid-cols-3"><div className="h-12 rounded-xl sm:h-20" style={{ backgroundColor: primaryColor }} /><div className="h-12 rounded-xl sm:h-20" style={{ backgroundColor: accentColor }} /><div className="h-12 rounded-xl border sm:h-20" style={{ backgroundColor: surfaceColor }} /></div></div></CardContent>
      </Card>
  </section>;
}
