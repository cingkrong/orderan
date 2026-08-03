import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { trackLincahOrder } from "@/lib/lincah.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  PackageSearch,
  Loader2,
  History,
  X,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tracking")({
  component: TrackingPage,
});

interface TrackingEvent {
  status?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  city?: string;
  timestamp?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface TrackingResult {
  resi: string;
  courier?: string;
  status?: string;
  origin?: string;
  destination?: string;
  estimated?: string;
  weight?: string | number;
  service?: string;
  history?: TrackingEvent[];
  rawDebug?: unknown;
}

type StatusConfig = {
  label: string;
  color: string;
  icon: typeof CheckCircle2;
  bgClass: string;
};

const STATUS_MAP: [string, StatusConfig][] = [
  ["delivered", { label: "Terkirim", color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2, bgClass: "bg-emerald-500" }],
  ["out for delivery", { label: "Dalam Pengiriman", color: "text-blue-600 dark:text-blue-400", icon: Truck, bgClass: "bg-blue-500" }],
  ["in transit", { label: "Dalam Perjalanan", color: "text-amber-600 dark:text-amber-400", icon: Truck, bgClass: "bg-amber-500" }],
  ["processing", { label: "Sedang Diproses", color: "text-purple-600 dark:text-purple-400", icon: Package, bgClass: "bg-purple-500" }],
  ["picked_up", { label: "Diambil Kurir", color: "text-sky-600 dark:text-sky-400", icon: Package, bgClass: "bg-sky-500" }],
  ["pick up", { label: "Diambil Kurir", color: "text-sky-600 dark:text-sky-400", icon: Package, bgClass: "bg-sky-500" }],
  ["cancelled", { label: "Dibatalkan", color: "text-red-600 dark:text-red-400", icon: AlertCircle, bgClass: "bg-red-500" }],
];

const HEADER_GRADIENTS: Record<string, string> = {
  "bg-emerald-500": "linear-gradient(135deg, #10b981, #059669)",
  "bg-blue-500": "linear-gradient(135deg, #3b82f6, #2563eb)",
  "bg-amber-500": "linear-gradient(135deg, #f59e0b, #d97706)",
  "bg-purple-500": "linear-gradient(135deg, #a855f7, #9333ea)",
  "bg-sky-500": "linear-gradient(135deg, #0ea5e9, #0284c7)",
  "bg-red-500": "linear-gradient(135deg, #ef4444, #dc2626)",
  "bg-slate-400": "linear-gradient(135deg, #94a3b8, #64748b)",
};

function getStatusConfig(status?: string): StatusConfig | null {
  if (!status) return null;
  const lower = status.toLowerCase().trim();
  for (const [key, val] of STATUS_MAP) {
    if (lower.includes(key)) return val;
  }
  return { label: status, color: "text-muted-foreground", icon: Clock, bgClass: "bg-slate-400" };
}

function formatEventDate(event: TrackingEvent): string {
  const raw = (event.timestamp || event.created_at || event.date) as string | undefined;
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return format(d, "dd MMM yyyy, HH:mm", { locale: idLocale });
  } catch {
    return raw;
  }
}

function TrackingPage() {
  const trackFn = useServerFn(trackLincahOrder);

  const [resiInput, setResiInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentList, setRecentList] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  async function handleTrack(resi?: string) {
    const target = (resi ?? resiInput).trim();
    if (!target) {
      toast.error("Masukkan nomor resi terlebih dahulu");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await trackFn({ data: { resiOrOrderId: target } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = res as any;

      // Coba berbagai kemungkinan struktur response Lincah API
      let events: TrackingEvent[] = [];
      if (Array.isArray(raw?.data)) {
        events = raw.data;
      } else if (Array.isArray(raw?.history)) {
        events = raw.history;
      } else if (Array.isArray(raw?.tracking)) {
        events = raw.tracking;
      } else if (Array.isArray(raw?.events)) {
        events = raw.events;
      } else if (raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
        events = [raw.data as TrackingEvent];
      }

      const topStatus =
        raw?.status ||
        raw?.data?.status ||
        events?.[0]?.status ||
        "Terdaftar";

      setResult({
        resi: target,
        courier: raw?.courier || raw?.data?.courier || raw?.logistics || raw?.courier_name,
        status: topStatus,
        origin: raw?.origin || raw?.sender_city || raw?.from,
        destination: raw?.destination || raw?.receiver_city || raw?.to,
        estimated: raw?.estimated || raw?.etd || raw?.eta,
        weight: raw?.weight,
        service: raw?.service || raw?.courier_service,
        history: events,
        rawDebug: raw,
      });

      setRecentList((prev) => [target, ...prev.filter((h) => h !== target)].slice(0, 10));

      if (events.length > 0) {
        toast.success(`Resi ${target} ditemukan — ${events.length} update pergerakan`);
      } else {
        toast.info(`Resi ${target} terdaftar, belum ada riwayat pergerakan`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(`Gagal melacak resi: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result?.resi) return;
    navigator.clipboard.writeText(result.resi);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const latestStatus = result ? getStatusConfig(result.status) : null;
  const events = result?.history ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <PackageSearch className="size-6" />
          </div>
          Lacak Resi
        </h1>
        <p className="text-muted-foreground text-sm pl-1">
          Lacak status pengiriman paket secara real-time melalui Lincah.id API
        </p>
      </div>

      {/* Search Card */}
      <Card className="p-5 shadow-sm">
        <div className="space-y-3">
          <label htmlFor="resi-input" className="text-sm font-semibold">
            Nomor Resi / Order ID
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="resi-input"
                placeholder="Contoh: JNE1234567890, LNCH2608A7NVAD3H..."
                value={resiInput}
                onChange={(e) => setResiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                className="pl-9 h-10 font-mono text-sm"
                autoFocus
              />
              {resiInput && (
                <button
                  type="button"
                  onClick={() => setResiInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Button
              onClick={() => handleTrack()}
              disabled={loading || !resiInput.trim()}
              className="h-10 px-5 gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {loading ? "Melacak..." : "Lacak"}
            </Button>
          </div>

          {/* Recent chips */}
          {recentList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <History className="size-3" /> Riwayat:
              </div>
              {recentList.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setResiInput(h);
                    handleTrack(h);
                  }}
                  className="font-mono text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-accent border border-border transition-colors"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Error State */}
      {error && !loading && (
        <Card className="p-5 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-destructive">Gagal Melacak Resi</div>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-7 text-xs gap-1.5"
                onClick={() => handleTrack()}
              >
                <RefreshCw className="size-3" /> Coba Lagi
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card className="p-6">
          <div className="space-y-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-3 pl-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="size-3 rounded-full bg-muted mt-1 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-2.5 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Result Card */}
      {result && !loading && (
        <Card className="overflow-hidden shadow-md">
          {/* Gradient header */}
          <div
            className="px-5 py-4 text-white"
            style={{
              background: latestStatus
                ? (HEADER_GRADIENTS[latestStatus.bgClass] ?? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.8))")
                : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.8))",
            }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                {latestStatus ? (
                  <latestStatus.icon className="size-9 opacity-90 shrink-0" />
                ) : (
                  <Package className="size-9 opacity-90 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-lg leading-tight">
                    {latestStatus?.label ?? result.status ?? "Dalam Proses"}
                  </div>
                  {(result.courier || result.service) && (
                    <div className="text-white/75 text-xs mt-0.5 uppercase tracking-wider">
                      {result.courier && `via ${result.courier}`}
                      {result.service && ` · ${result.service}`}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold tracking-wide break-all">{result.resi}</div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-white/70 hover:text-white text-xs flex items-center gap-1 mt-1 ml-auto transition-colors"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "Disalin!" : "Salin resi"}
                </button>
              </div>
            </div>
          </div>

          {/* Info strip */}
          {(result.origin || result.destination || result.estimated || result.weight) && (
            <div className="px-5 py-2.5 bg-muted/30 border-b flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
              {result.origin && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3 text-primary shrink-0" />
                  <span className="font-medium text-foreground">Asal:</span>&nbsp;{result.origin}
                </div>
              )}
              {result.destination && (
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="size-3 text-primary shrink-0" />
                  <span className="font-medium text-foreground">Tujuan:</span>&nbsp;{result.destination}
                </div>
              )}
              {result.estimated && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3 text-primary shrink-0" />
                  <span className="font-medium text-foreground">Estimasi:</span>&nbsp;{result.estimated}
                </div>
              )}
              {result.weight && (
                <div className="flex items-center gap-1.5">
                  <Package className="size-3 text-primary shrink-0" />
                  <span className="font-medium text-foreground">Berat:</span>&nbsp;{result.weight}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="p-5">
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="size-10 mx-auto mb-2 opacity-25" />
                <div className="text-sm font-medium">Resi terdaftar</div>
                <div className="text-xs mt-1">Belum ada riwayat pergerakan paket</div>
                <p className="text-xs mt-3 text-amber-600 dark:text-amber-400">
                  ⚠ Buka <strong>Debug panel</strong> di bawah untuk lihat raw response API
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
                  <History className="size-4 text-muted-foreground" />
                  Riwayat Pergerakan
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {events.length} update
                  </Badge>
                </h3>
                <ol className="relative border-l-2 border-border ml-3">
                  {events.map((ev, idx) => {
                    const evCfg = getStatusConfig(ev.status);
                    const isFirst = idx === 0;
                    return (
                      <li key={idx} className="ml-5 pb-5 last:pb-0">
                        <span
                          className={cn(
                            "absolute -left-[9px] flex size-4 items-center justify-center rounded-full border-2 border-background transition-colors",
                            isFirst ? (evCfg?.bgClass ?? "bg-primary") : "bg-border"
                          )}
                        />
                        <div
                          className={cn(
                            "rounded-lg px-3.5 py-3 border transition-colors",
                            isFirst
                              ? "bg-primary/5 border-primary/20 shadow-xs"
                              : "bg-background hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="space-y-0.5 min-w-0">
                              <div
                                className={cn(
                                  "font-semibold text-sm",
                                  isFirst ? (evCfg?.color ?? "text-primary") : "text-foreground"
                                )}
                              >
                                {ev.description || ev.status || "Update status"}
                              </div>
                              {(ev.location || ev.city) && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="size-3 shrink-0" />
                                  {(ev.location || ev.city) as string}
                                </div>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 tabular-nums">
                              {formatEventDate(ev)}
                            </div>
                          </div>
                          {isFirst && (
                            <Badge
                              variant="secondary"
                              className={cn("mt-2 text-[10px] font-medium gap-1", evCfg?.color)}
                            >
                              <span className="size-1.5 rounded-full inline-block bg-current" />
                              Status Terkini
                            </Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-4 flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
            <span className="flex items-center gap-1.5">
              <Truck className="size-3" /> Data dari Lincah.id API
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => handleTrack(result.resi)}
            >
              <RefreshCw className="size-3" /> Refresh
            </Button>
          </div>
        </Card>
      )}

      {/* Debug panel — raw API response */}
      {result?.rawDebug && (
        <details className="rounded-lg border border-dashed border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 select-none">
            <AlertCircle className="size-3.5" />
            Debug: Raw API Response (klik untuk buka)
          </summary>
          <pre className="px-4 pb-4 text-[10px] font-mono overflow-x-auto text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
            {JSON.stringify(result.rawDebug, null, 2)}
          </pre>
        </details>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <div className="p-5 rounded-full bg-muted/50 mb-4">
            <PackageSearch className="size-10 opacity-40" />
          </div>
          <h3 className="font-semibold text-base text-foreground">Masukkan nomor resi</h3>
          <p className="text-sm mt-1 max-w-xs leading-relaxed">
            Ketik atau tempel nomor resi di kolom pencarian di atas, lalu klik{" "}
            <strong>Lacak</strong> untuk melihat status pengiriman.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 w-full max-w-xs">
            {["JNE", "SiCepat", "Lincah.id"].map((courier) => (
              <div
                key={courier}
                className="p-2.5 rounded-lg border border-dashed text-xs font-medium flex items-center justify-center gap-1.5 text-muted-foreground"
              >
                <Truck className="size-3.5 shrink-0" /> {courier}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
