export const formatIDR = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v || 0);
};

export const formatNumber = (n: number | null | undefined) =>
  new Intl.NumberFormat("id-ID").format(n ?? 0);

export const formatWeight = (g: number | null | undefined, unit: "g" | "kg" = "g") => {
  const v = g ?? 0;
  if (unit === "kg") return `${(v / 1000).toFixed(2)} kg`;
  return `${v} g`;
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Tertunda",
  confirmed: "Dikonfirmasi",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-info/15 text-info",
  processing: "bg-warning/20 text-warning-foreground",
  shipped: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

export const SOURCES = ["WA", "Shopee", "FB Ads", "TikTok", "Affiliate", "Other"] as const;
export const COURIERS = ["jne", "jnt", "sicepat", "pos", "tiki", "anteraja", "ide", "wahana"] as const;
export const COURIER_LABEL: Record<string, string> = {
  jne: "JNE",
  jnt: "J&T",
  sicepat: "SiCepat",
  pos: "POS Indonesia",
  tiki: "TIKI",
  anteraja: "AnterAja",
  ide: "ID Express",
  wahana: "Wahana",
};
