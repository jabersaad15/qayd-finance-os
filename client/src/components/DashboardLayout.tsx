import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { trpc } from "@/lib/trpc";
import { selectActiveWorkspace } from "@/lib/workspaceSelection";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, BadgeCheck, BellRing, BookOpenText, Building2, CalendarDays, CheckCircle2, ClipboardCheck, CreditCard, FileText, Gavel, LayoutDashboard, LogOut, Mail, Palette, PlugZap, ReceiptText, Send, Settings, Settings2, ShieldAlert, ShieldCheck, Sparkles, Target, TrendingUp, UserRound, UsersRound, WalletCards, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { PRODUCT_BRAND } from "../../../shared/productBrand";
import { MarketingFooter } from "./MarketingFooter";
import LocalLogin from "@/pages/LocalLogin";

type MenuItem = { icon: LucideIcon; label: string; path: string; anchor?: string };

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/" },
  { icon: ClipboardCheck, label: "لوحة المحاسب", path: "/accountant" },
  { icon: ReceiptText, label: "قسم المبيعات", path: "/sales" },
  { icon: ReceiptText, label: "قسم الفوترة", path: "/billing" },
  { icon: BookOpenText, label: "المحاسبة", path: "/accounting" },
  { icon: BookOpenText, label: "إدارة دليل الحسابات", path: "/accounts" },
  { icon: WalletCards, label: "التشغيل المالي", path: "/operations" },
  { icon: ShieldCheck, label: "الضرائب والامتثال", path: "/tax" },
  { icon: FileText, label: "غرفة المستندات", path: "/documents" },
  { icon: ClipboardCheck, label: "مراجعة الإقفال", path: "/audit" },
  { icon: Settings, label: "إعدادات الشركة", path: "/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();
  const workspaces = trpc.finance.listMyWorkspaces.useQuery(undefined, { enabled: Boolean(user) });

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return <LocalLogin />;
  }

  return (
    <SidebarProvider>
      <DashboardLayoutContent>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = { children: React.ReactNode };

function DashboardLayoutContent({
  children,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const workspaces = trpc.finance.listMyWorkspaces.useQuery(undefined, { enabled: Boolean(user) });
  const activeWorkspace = selectActiveWorkspace(workspaces.data);
  const branding = trpc.finance.getCompanyBranding.useQuery({ tenantId: activeWorkspace?.tenant.id ?? 0, companyId: activeWorkspace?.company?.id ?? 0 }, { enabled: Boolean(activeWorkspace?.tenant.id && activeWorkspace?.company?.id) });
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const activeMenuItem = menuItems.find(item => item.path === location);
  const roleCode = user?.role === "admin" ? "super_admin" : activeWorkspace?.role?.code;
  const salesRepMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "الرئيسية", path: "/", anchor: "sales-rep-dashboard" },
    { icon: UsersRound, label: "العملاء المحتملون", path: "/sales", anchor: "sales-rep-leads" },
    { icon: UsersRound, label: "العملاء", path: "/sales", anchor: "sales-rep-customers" },
    { icon: Target, label: "الفرص", path: "/sales", anchor: "sales-rep-opportunities" },
    { icon: ReceiptText, label: "عروض الأسعار", path: "/sales", anchor: "sales-rep-quotations" },
    { icon: ClipboardCheck, label: "المهام والمتابعات", path: "/sales", anchor: "sales-rep-tasks" },
    { icon: BarChart3, label: "أدائي", path: "/sales", anchor: "sales-rep-performance" },
    { icon: BellRing, label: "الإشعارات", path: "/sales", anchor: "sales-rep-notifications" },
    { icon: UserRound, label: "حسابي", path: "/", anchor: "sales-rep-profile" },
  ];
  const financeManagerMenuItems = menuItems.filter((item) => item.path !== "/sales" && item.path !== "/settings");
  const ceoMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "الرئيسية", path: "/", anchor: "ceo-command-center" },
    { icon: CheckCircle2, label: "Approvals | الموافقات", path: "/", anchor: "ceo-decisions-required" },
    { icon: BarChart3, label: "Company Performance", path: "/", anchor: "ceo-command-center" },
    { icon: TrendingUp, label: "Sales Overview", path: "/", anchor: "ceo-command-center" },
    { icon: WalletCards, label: "Financial Overview", path: "/", anchor: "ceo-command-center" },
    { icon: ClipboardCheck, label: "Operations Overview", path: "/", anchor: "ceo-command-center" },
    { icon: Gavel, label: "Executive Decisions", path: "/", anchor: "ceo-decisions-required" },
    { icon: FileText, label: "Executive Reports", path: "/", anchor: "ceo-command-center" },
    { icon: ShieldAlert, label: "Risks & Opportunities", path: "/", anchor: "ceo-command-center" },
    { icon: Sparkles, label: "AI Executive", path: "/", anchor: "ceo-command-center" },
    { icon: BellRing, label: "Alerts", path: "/", anchor: "ceo-command-center" },
    { icon: UserRound, label: "My Profile", path: "/" },
  ];
  const companyAdminMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "الرئيسية", path: "/", anchor: "company-admin-dashboard" },
    { icon: UsersRound, label: "المستخدمون", path: "/", anchor: "admin-users" },
    { icon: Settings2, label: "الأدوار والصلاحيات", path: "/", anchor: "roles" },
    { icon: Building2, label: "ملف الشركة والفروع", path: "/", anchor: "company" },
    { icon: Palette, label: "الإعدادات والهوية", path: "/", anchor: "settings" },
    { icon: PlugZap, label: "التكاملات", path: "/", anchor: "settings" },
    { icon: ShieldCheck, label: "الأمان والنشاط", path: "/", anchor: "security" },
    { icon: CreditCard, label: "الاشتراك والاستخدام", path: "/", anchor: "subscription" },
    { icon: UserRound, label: "حسابي", path: "/" },
  ];
  const executiveAssistantMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "الرئيسية", path: "/" },
    { icon: BarChart3, label: "Executive Dashboard", path: "/", anchor: "executive-assistant-dashboard" },
    { icon: Send, label: "طلبات المدير", path: "/", anchor: "ea-request-form" },
    { icon: Target, label: "المتابعات", path: "/", anchor: "ea-decisions" },
    { icon: Gavel, label: "القرارات", path: "/", anchor: "ea-decisions" },
    { icon: ClipboardCheck, label: "المهام التنفيذية", path: "/", anchor: "ea-decision-form" },
    { icon: CalendarDays, label: "الاجتماعات والتقويم", path: "/", anchor: "ea-meeting-form" },
    { icon: FileText, label: "المستندات التنفيذية", path: "/" },
    { icon: BookOpenText, label: "التقارير المختصرة", path: "/", anchor: "executive-assistant-dashboard" },
    { icon: BellRing, label: "التنبيهات", path: "/", anchor: "executive-assistant-dashboard" },
    { icon: UserRound, label: "حسابي", path: "/" },
  ];
  const operationsManagerMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "الرئيسية", path: "/" },
    { icon: BarChart3, label: "مركز العمليات", path: "/", anchor: "ops-control-center" },
    { icon: ClipboardCheck, label: "المهام التشغيلية", path: "/", anchor: "ops-task-form" },
    { icon: ShieldCheck, label: "المشكلات والحوادث", path: "/", anchor: "ops-issue-form" },
    { icon: Send, label: "الطلبات الداخلية", path: "/", anchor: "ops-request-form" },
    { icon: Target, label: "مؤشرات الأداء", path: "/", anchor: "ops-kpis" },
    { icon: BellRing, label: "التنبيهات", path: "/", anchor: "ops-interventions" },
    { icon: UserRound, label: "حسابي", path: "/" },
  ];
  const administrativeAssistantMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "الرئيسية", path: "/" },
    { icon: ClipboardCheck, label: "مهامي", path: "/", anchor: "admin-task-form" },
    { icon: CalendarDays, label: "الاجتماعات", path: "/", anchor: "admin-meeting-form" },
    { icon: BellRing, label: "المتابعات والتذكيرات", path: "/", anchor: "admin-request-form" },
    { icon: Mail, label: "المراسلات", path: "/", anchor: "admin-correspondence-form" },
    { icon: FileText, label: "المستندات", path: "/", anchor: "admin-correspondence-form" },
    { icon: UsersRound, label: "جهات الاتصال", path: "/" },
    { icon: UserRound, label: "حسابي", path: "/" },
  ];
  const restrictedPaths: Record<string, string[]> = {
    sales: ["/", "/sales"],
    sales_rep: ["/", "/sales"],
    external_auditor: ["/", "/audit", "/documents"],
    read_only: ["/"],
    ceo_assistant: ["/"],
    operations_manager: ["/"],
    executive_assistant: ["/"],
    company_admin: ["/"],
    general_manager: ["/"],
  };
  const visibleMenuItems = roleCode === "super_admin" ? menuItems : roleCode === "sales_rep" ? salesRepMenuItems : roleCode === "company_admin" ? companyAdminMenuItems : roleCode === "general_manager" ? ceoMenuItems : roleCode === "executive_assistant" ? executiveAssistantMenuItems : roleCode === "operations_manager" ? operationsManagerMenuItems : roleCode === "ceo_assistant" ? administrativeAssistantMenuItems : (roleCode === "cfo" || roleCode === "finance_manager") ? financeManagerMenuItems : roleCode && restrictedPaths[roleCode] ? menuItems.filter((item) => restrictedPaths[roleCode].includes(item.path)) : menuItems;
  const isMobile = useIsMobile();
  const brand = branding.data;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", brand?.primaryColor ?? "#0B3D3A");
    root.style.setProperty("--brand-accent", brand?.accentColor ?? "#4A82C4");
    root.style.setProperty("--brand-surface", brand?.surfaceColor ?? "#F6F7F4");
    document.title = `${brand?.displayNameAr || brand?.displayNameEn || PRODUCT_BRAND.bilingual} | ${PRODUCT_BRAND.arabicTagline}`;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
    favicon.href = brand?.faviconUrl || "/manus-storage/consedra-logo-square_12f98105.jpg";
  }, [brand?.accentColor, brand?.displayNameAr, brand?.displayNameEn, brand?.faviconUrl, brand?.primaryColor, brand?.surfaceColor]);

  useEffect(() => {
    if (isCollapsed) document.body.style.cursor = "";
  }, [isCollapsed]);

  return (
    <>
      <div className="relative" dir="rtl">
        <Sidebar side="right" collapsible="icon" className="border-l border-l-[#dbe2dd] bg-[#fbfcfa]">
          <SidebarHeader className="h-20 justify-center border-b border-b-[#edf0ec]">
            <div className="flex items-center gap-3 px-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-[#e7f0eb] rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b3d3a] shrink-0"
                aria-label="طي القائمة"
              >
                {brand?.faviconUrl ? <img src={brand.faviconUrl} alt="شعار الشركة" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/manus-storage/consedra-logo-square_12f98105.jpg"; }} className="h-7 w-7 rounded-lg object-contain" /> : <Building2 className="h-4 w-4 text-[#0b3d3a]" />}
              </button>
              {!isCollapsed ? (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold tracking-tight truncate text-[#0b3d3a]">
                    {brand?.displayNameAr || brand?.displayNameEn || PRODUCT_BRAND.bilingual}
                  </span>
                  <span className="text-[10px] text-muted-foreground tracking-[0.12em] uppercase">{PRODUCT_BRAND.english}</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-3 py-4 gap-1">
              {visibleMenuItems.map((item, index) => {
                const isActive = location === item.path;
                const itemKey = `${item.path}:${item.anchor ?? "root"}:${index}`;
                return (
                  <SidebarMenuItem key={itemKey}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => { const anchor = item.anchor; if (anchor && location === item.path) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }); else { setLocation(item.path); if (anchor) window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120); } }}
                      tooltip={item.label}
                      className="h-11 transition-all font-medium rounded-xl data-[active=true]:bg-[#e6f0eb] data-[active=true]:text-[#0b3d3a]"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="space-y-2 p-3 border-t border-t-[#edf0ec]">
            <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <ThemeToggle compact={isCollapsed} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#eef5f0] transition-colors w-full text-right group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b3d3a]">
                  <Avatar className="h-9 w-9 border border-[#d5e3da] shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-semibold truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
      </div>

      <SidebarInset className="bg-[#f6f7f4]" style={{ backgroundColor: brand?.surfaceColor ?? "#F6F7F4" }} dir="rtl">
        {isMobile && (
          <div className="flex border-b border-[#e4e7e1] h-14 items-center justify-between bg-[#fbfcfa]/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight font-semibold text-[#0b3d3a]">
                    {activeMenuItem?.label ?? "المنصة"}
                  </span>
                </div>
              </div>
            </div>
            <ThemeToggle compact />
          </div>
        )}
        <main className="flex-1 p-4 md:p-7">{children}</main>
        <MarketingFooter />
      </SidebarInset>
    </>
  );
}
