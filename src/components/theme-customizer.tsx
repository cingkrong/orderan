import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  THEME_PRESETS,
  getStoredThemeConfig,
  applyThemeConfig,
  type ThemeMode,
  type ThemePreset,
  type ThemeConfig,
} from "@/lib/theme-manager";
import { Sun, Moon, Monitor, Palette, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ThemeCustomizer() {
  const [config, setConfig] = useState<ThemeConfig>(() => getStoredThemeConfig());

  useEffect(() => {
    applyThemeConfig(config);
  }, [config]);

  const handleModeChange = (mode: ThemeMode) => {
    const nextConfig = { ...config, mode };
    setConfig(nextConfig);
    applyThemeConfig(nextConfig);
    toast.success(`Moda tema diubah ke ${mode === "dark" ? "Gelap (Dark)" : mode === "light" ? "Terang (Light)" : "Sistem"}`);
  };

  const handlePresetChange = (preset: ThemePreset) => {
    const nextConfig = { ...config, preset };
    setConfig(nextConfig);
    applyThemeConfig(nextConfig);
    toast.success(`Palet warna diubah ke "${THEME_PRESETS.find((p) => p.id === preset)?.name}"`);
  };

  return (
    <Card className="p-5 space-y-6 shadow-sm border-border">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Palette className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base flex items-center gap-2">
              Tema &amp; Tampilan Admin
              <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                <Sparkles className="size-3 mr-1 text-amber-500" /> Customizer
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Pilih moda tampilan dan palet warna favorit Anda untuk kenyamanan bekerja di Maularis OMS.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selection (Light, Dark, System) */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span>1. Moda Tampilan (Mode)</span>
        </Label>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange("light")}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all text-xs font-medium relative",
              config.mode === "light"
                ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20 shadow-sm"
                : "border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground",
            )}
          >
            <Sun className="size-5" />
            <span>Terang (Light)</span>
            {config.mode === "light" && (
              <span className="absolute top-2 right-2 size-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                <Check className="size-3" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("dark")}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all text-xs font-medium relative",
              config.mode === "dark"
                ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20 shadow-sm"
                : "border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground",
            )}
          >
            <Moon className="size-5" />
            <span>Gelap (Dark)</span>
            {config.mode === "dark" && (
              <span className="absolute top-2 right-2 size-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                <Check className="size-3" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("system")}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all text-xs font-medium relative",
              config.mode === "system"
                ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20 shadow-sm"
                : "border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground",
            )}
          >
            <Monitor className="size-5" />
            <span>Ikuti Sistem</span>
            {config.mode === "system" && (
              <span className="absolute top-2 right-2 size-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                <Check className="size-3" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Preset Selection Cards */}
      <div className="space-y-3 pt-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span>2. Palet Warna Aksen (Theme Preset)</span>
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {THEME_PRESETS.map((preset) => {
            const isSelected = config.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetChange(preset.id)}
                className={cn(
                  "flex flex-col text-left p-3.5 rounded-xl border transition-all relative overflow-hidden group",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                    : "border-border hover:border-primary/50 hover:bg-accent/40",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-4 rounded-full border border-black/20 dark:border-white/20 shadow-inner shrink-0"
                      style={{ backgroundColor: preset.primaryColor }}
                    />
                    <span className="font-semibold text-xs text-foreground truncate">{preset.name}</span>
                  </div>
                  {isSelected && (
                    <span className="size-5 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
                      <Check className="size-3" />
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                  {preset.description}
                </p>

                {/* Mini Live Layout Preview Box */}
                <div
                  className={cn(
                    "w-full h-12 rounded-lg border p-1.5 flex items-center gap-1.5 transition-transform group-hover:scale-[1.02]",
                    preset.previewBg,
                    preset.previewBorder,
                  )}
                >
                  <div className="w-1/4 h-full rounded bg-white/10 flex flex-col gap-1 p-1">
                    <div className="w-full h-1 rounded" style={{ backgroundColor: preset.primaryColor }} />
                    <div className="w-2/3 h-1 rounded bg-white/20" />
                  </div>
                  <div className="flex-1 h-full rounded bg-white/5 p-1 flex flex-col justify-between">
                    <div className="w-full h-1.5 rounded" style={{ backgroundColor: preset.primaryColor }} />
                    <div className="w-1/2 h-1 rounded bg-white/20" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("text-xs font-semibold text-foreground", className)}>{children}</div>;
}
