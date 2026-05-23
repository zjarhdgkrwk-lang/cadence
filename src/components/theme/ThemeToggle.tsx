import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore, type Theme } from "@/stores/uiStore";

const CYCLE: Theme[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore();

  function cycleTheme() {
    const idx = CYCLE.indexOf(theme);
    setTheme(CYCLE[(idx + 1) % CYCLE.length]);
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = theme === "light" ? "라이트" : theme === "dark" ? "다크" : "시스템";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={`테마: ${label}`}
      title={`테마: ${label}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
