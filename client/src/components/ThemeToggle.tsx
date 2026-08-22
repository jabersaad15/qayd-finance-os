import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;
  const isDark = theme === "dark";
  const label = isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${compact ? "h-9 w-9" : "h-10 gap-2 px-3"}`}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      {!compact ? <span className="text-xs font-medium">{isDark ? "نهاري" : "ليلي"}</span> : null}
    </button>
  );
}
