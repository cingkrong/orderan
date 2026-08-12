export type ThemeMode = "light" | "dark" | "system";

export type ThemePreset =
  | "indigo"
  | "emerald"
  | "dark-slate"
  | "midnight"
  | "rose"
  | "slate";

export interface ThemeConfig {
  mode: ThemeMode;
  preset: ThemePreset;
}

export interface ThemePresetDetail {
  id: ThemePreset;
  name: string;
  description: string;
  primaryColor: string;
  previewBg: string;
  previewCard: string;
  previewBorder: string;
  isDarkOnly?: boolean;
}

export const THEME_PRESETS: ThemePresetDetail[] = [
  {
    id: "indigo",
    name: "Shadcn Indigo",
    description: "Tema bawaan Shadcn UI dengan aksen warna Indigo khas bisnis modern",
    primaryColor: "oklch(0.55 0.18 255)",
    previewBg: "bg-slate-900",
    previewCard: "bg-slate-800",
    previewBorder: "border-indigo-500",
  },
  {
    id: "emerald",
    name: "Emerald Logistics",
    description: "Tema warna Hijau Logistik yang segar & profesional untuk pengiriman",
    primaryColor: "oklch(0.58 0.18 160)",
    previewBg: "bg-emerald-950",
    previewCard: "bg-emerald-900/60",
    previewBorder: "border-emerald-500",
  },
  {
    id: "dark-slate",
    name: "Modern Dark Slate",
    description: "Tampilan gelap eksklusif dengan aksen kontras biru elektrik",
    primaryColor: "oklch(0.6 0.2 245)",
    previewBg: "bg-zinc-950",
    previewCard: "bg-zinc-900",
    previewBorder: "border-blue-500",
    isDarkOnly: true,
  },
  {
    id: "midnight",
    name: "Midnight Neon",
    description: "Tema futuristik gelap dengan aksen Cyan & Purple kontras tinggi",
    primaryColor: "oklch(0.68 0.18 190)",
    previewBg: "bg-slate-950",
    previewCard: "bg-slate-900",
    previewBorder: "border-cyan-400",
    isDarkOnly: true,
  },
  {
    id: "rose",
    name: "Sunset Rose",
    description: "Tema hangat dengan aksen Merah Crimson & Rose Gold",
    primaryColor: "oklch(0.58 0.22 15)",
    previewBg: "bg-stone-900",
    previewCard: "bg-stone-800",
    previewBorder: "border-rose-500",
  },
  {
    id: "slate",
    name: "Corporate Slate",
    description: "Tema monokrom minimalis yang bersih & elegan untuk korporasi",
    primaryColor: "oklch(0.45 0.05 260)",
    previewBg: "bg-slate-900",
    previewCard: "bg-slate-800",
    previewBorder: "border-slate-400",
  },
];

const PRESET_CSS_VARS: Record<ThemePreset, { primary: string; sidebarPrimary: string; ring: string; chart1: string }> = {
  indigo: {
    primary: "oklch(0.55 0.18 255)",
    sidebarPrimary: "oklch(0.65 0.18 255)",
    ring: "oklch(0.55 0.18 255)",
    chart1: "oklch(0.55 0.18 255)",
  },
  emerald: {
    primary: "oklch(0.58 0.18 160)",
    sidebarPrimary: "oklch(0.62 0.18 160)",
    ring: "oklch(0.58 0.18 160)",
    chart1: "oklch(0.58 0.18 160)",
  },
  "dark-slate": {
    primary: "oklch(0.6 0.2 245)",
    sidebarPrimary: "oklch(0.65 0.2 245)",
    ring: "oklch(0.6 0.2 245)",
    chart1: "oklch(0.6 0.2 245)",
  },
  midnight: {
    primary: "oklch(0.68 0.18 190)",
    sidebarPrimary: "oklch(0.72 0.18 190)",
    ring: "oklch(0.68 0.18 190)",
    chart1: "oklch(0.68 0.18 190)",
  },
  rose: {
    primary: "oklch(0.58 0.22 15)",
    sidebarPrimary: "oklch(0.65 0.22 15)",
    ring: "oklch(0.58 0.22 15)",
    chart1: "oklch(0.58 0.22 15)",
  },
  slate: {
    primary: "oklch(0.45 0.05 260)",
    sidebarPrimary: "oklch(0.55 0.05 260)",
    ring: "oklch(0.45 0.05 260)",
    chart1: "oklch(0.45 0.05 260)",
  },
};

export function getStoredThemeConfig(): ThemeConfig {
  if (typeof window === "undefined") {
    return { mode: "system", preset: "indigo" };
  }
  const mode = (localStorage.getItem("maularis_theme_mode") as ThemeMode) || "system";
  const preset = (localStorage.getItem("maularis_theme_preset") as ThemePreset) || "indigo";
  return { mode, preset };
}

export function applyThemeConfig(config: ThemeConfig) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const isDark =
    config.mode === "dark" ||
    (config.mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  root.setAttribute("data-theme", config.preset);

  // Apply custom CSS variable overrides for preset primary colors
  const vars = PRESET_CSS_VARS[config.preset] || PRESET_CSS_VARS.indigo;
  root.style.setProperty("--primary", vars.primary);
  root.style.setProperty("--sidebar-primary", vars.sidebarPrimary);
  root.style.setProperty("--ring", vars.ring);
  root.style.setProperty("--chart-1", vars.chart1);

  localStorage.setItem("maularis_theme_mode", config.mode);
  localStorage.setItem("maularis_theme_preset", config.preset);
}
