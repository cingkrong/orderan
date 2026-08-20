import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getIntegrations,
  updateIntegrationConfig,
  IntegrationPlugin,
} from "@/lib/integrations.functions";
import {
  getMiddlewareHealth,
  getMiddlewareLogs,
  runApiPlaygroundTest,
  getMiddlewareApiDocs,
  MiddlewareLog,
} from "@/lib/middleware.functions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  MessageSquare,
  ShoppingBag,
  Video,
  Store,
  Webhook,
  Puzzle,
  Search,
  CheckCircle2,
  Settings,
  Plug,
  Activity,
  Terminal,
  FileText,
  RefreshCw,
  Play,
  Copy,
  Check,
  AlertCircle,
  Clock,
  ShieldCheck,
  Zap,
  Server,
  Code,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: UnifiedIntegrationsPage,
});

const ICON_MAP: Record<string, any> = {
  Truck,
  MessageSquare,
  ShoppingBag,
  Video,
  Store,
  Webhook,
};

function UnifiedIntegrationsPage() {
  const queryClient = useQueryClient();

  // Server functions
  const fetchPlugins = useServerFn(getIntegrations);
  const savePlugin = useServerFn(updateIntegrationConfig);
  const fetchHealth = useServerFn(getMiddlewareHealth);
  const fetchLogs = useServerFn(getMiddlewareLogs);
  const executePlayground = useServerFn(runApiPlaygroundTest);
  const fetchDocs = useServerFn(getMiddlewareApiDocs);

  // Queries
  const { data: plugins, isLoading: loadingPlugins } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetchPlugins(),
  });

  const {
    data: health,
    isLoading: loadingHealth,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["middleware-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 15000,
  });

  const {
    data: logsData,
    isLoading: loadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["middleware-logs"],
    queryFn: () => fetchLogs(),
    refetchInterval: 10000,
  });

  const { data: apiDocs } = useQuery({
    queryKey: ["middleware-docs"],
    queryFn: () => fetchDocs(),
  });

  // Main navigation tab state
  const [mainTab, setMainTab] = useState<"services" | "health" | "playground" | "logs" | "docs">(
    "services",
  );

  // Filter state for services
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");

  // Setup Modal State
  const [selectedPlugin, setSelectedPlugin] = useState<IntegrationPlugin | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formEnabled, setFormEnabled] = useState(false);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});

  // Playground state
  const [pgAction, setPgAction] = useState<
    | "lincah_me"
    | "lincah_search_district"
    | "lincah_ongkir"
    | "whatsapp_send_test"
    | "webhook_test_trigger"
  >("lincah_me");
  const [pgParams, setPgParams] = useState<Record<string, any>>({
    q: "Semarang",
    origin_code: "33.72.01",
    destination_code: "31.71.01",
    weight_g: 1000,
    phone: "081234567890",
    message: "Tes notifikasi dari Middleware MAULARIS Platform API.",
    url: "https://n8n.example.com/webhook/orders",
  });
  const [pgResult, setPgResult] = useState<any>(null);
  const [pgCopySuccess, setPgCopySuccess] = useState(false);

  // Log Modal Inspect
  const [selectedLog, setSelectedLog] = useState<MiddlewareLog | null>(null);
  const [logFilterStatus, setLogFilterStatus] = useState<string>("all");
  const [logSearchQ, setLogSearchQ] = useState("");

  // Save Plugin Config Mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlugin) throw new Error("Plugin tidak dipilih");
      return savePlugin({
        data: {
          id: selectedPlugin.id,
          enabled: formEnabled,
          config: formConfig,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Pengaturan integrasi "${selectedPlugin?.name}" berhasil disimpan!`);
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["middleware-health"] });
      queryClient.invalidateQueries({ queryKey: ["middleware-docs"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan integrasi");
    },
  });

  // Playground Mutation
  const playgroundMutation = useMutation({
    mutationFn: async () => {
      return executePlayground({
        data: {
          action: pgAction,
          params: pgParams,
        },
      });
    },
    onSuccess: (res) => {
      setPgResult(res);
      refetchLogs();
      if (res.success) {
        toast.success(`API Test "${pgAction}" sukses (${res.latencyMs} ms)`);
      } else {
        toast.error(`API Test gagal: ${res.error}`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengeksekusi API Playground");
    },
  });

  function openSetupModal(plugin: IntegrationPlugin) {
    setSelectedPlugin(plugin);
    setFormEnabled(plugin.enabled);
    setFormConfig({ ...plugin.config });
    setModalOpen(true);
  }

  const allPlugins = plugins ?? [];
  const filteredPlugins = allPlugins.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchSearch =
      !searchQ ||
      p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchSearch;
  });

  // Filter logs
  const allLogs = logsData?.logs ?? [];
  const filteredLogs = allLogs.filter((l) => {
    const matchStatus =
      logFilterStatus === "all" ||
      (logFilterStatus === "success" && l.success) ||
      (logFilterStatus === "error" && !l.success);
    const matchSearch =
      !logSearchQ ||
      l.service.toLowerCase().includes(logSearchQ.toLowerCase()) ||
      l.endpoint.toLowerCase().includes(logSearchQ.toLowerCase()) ||
      String(l.status).includes(logSearchQ);
    return matchStatus && matchSearch;
  });

  const lincahService = health?.services?.find((s) => s.id === "lincah");

  return (
    <div className="space-y-6 pb-16">
      {/* ═══ HEADER BANNER ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="size-3.5" /> Platform API Gateway & Middleware Internal
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Dashboard Integrasi Satu Pintu
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Pusat pengelolaan middleware API terpadu untuk **Lincah.id OpenAPI** (dengan Partner
              ID), WhatsApp Gateway, Outbound Webhooks, dan Marketplace Seller APIs.
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3 text-center">
              <div className="text-xs text-slate-300">Lincah Partner ID</div>
              <div
                className="text-xs font-mono font-bold text-amber-300 mt-1 truncate max-w-[130px]"
                title={lincahService?.partnerId}
              >
                {lincahService?.partnerId
                  ? `${lincahService.partnerId.slice(0, 8)}...`
                  : "Belum Setup"}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3 text-center">
              <div className="text-xs text-slate-300">Saldo Deposit Lincah</div>
              <div className="text-sm font-extrabold text-emerald-400 mt-1">
                Rp {(lincahService?.balance ?? 0).toLocaleString("id-ID")}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3 text-center">
              <div className="text-xs text-slate-300">Status Server API</div>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold text-emerald-300 uppercase">
                  {lincahService?.env === "production" ? "Production Live" : "Sandbox"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MAIN NAVIGATION TABS ═══ */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/80 rounded-xl gap-1">
          <TabsTrigger value="services" className="text-xs font-semibold py-2.5 gap-2">
            <Plug className="size-4" />
            <span>Layanan Terhubung</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="text-xs font-semibold py-2.5 gap-2">
            <Activity className="size-4" />
            <span>Health Monitor</span>
          </TabsTrigger>
          <TabsTrigger value="playground" className="text-xs font-semibold py-2.5 gap-2">
            <Terminal className="size-4" />
            <span>API Playground</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs font-semibold py-2.5 gap-2">
            <FileText className="size-4" />
            <span>Request Logs ({logsData?.totalLogs ?? 0})</span>
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs font-semibold py-2.5 gap-2">
            <Code className="size-4" />
            <span>Dokumentasi API</span>
          </TabsTrigger>
        </TabsList>

        {/* ════════ TAB 1: LAYANAN TERHUBUNG (SERVICES) ════════ */}
        <TabsContent value="services" className="mt-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Tabs
              value={activeCategory}
              onValueChange={setActiveCategory}
              className="w-full md:w-auto"
            >
              <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                <TabsTrigger value="all" className="text-xs">
                  Semua ({allPlugins.length})
                </TabsTrigger>
                <TabsTrigger value="shipping" className="text-xs">
                  Ekspedisi & Logistik
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="text-xs">
                  WhatsApp Gateway
                </TabsTrigger>
                <TabsTrigger value="marketplace" className="text-xs">
                  Marketplace APIs
                </TabsTrigger>
                <TabsTrigger value="webhook" className="text-xs">
                  Webhook Automation
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 text-xs"
                placeholder="Cari platform integrasi middleware..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>
          </div>

          {loadingPlugins ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Skeleton className="h-60 rounded-xl" />
              <Skeleton className="h-60 rounded-xl" />
              <Skeleton className="h-60 rounded-xl" />
            </div>
          ) : filteredPlugins.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground text-sm space-y-2">
              <Plug className="size-8 mx-auto opacity-40 text-primary" />
              <p>Tidak ada addon/integrasi ditemukan untuk pencarian ini.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlugins.map((plugin) => {
                const IconComponent = ICON_MAP[plugin.iconName] || Puzzle;
                return (
                  <Card
                    key={plugin.id}
                    className={cn(
                      "p-5 flex flex-col justify-between space-y-4 border transition-all hover:shadow-lg relative overflow-hidden",
                      plugin.enabled
                        ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 to-transparent"
                        : "bg-card hover:border-slate-300",
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                          <IconComponent className="size-6" />
                        </div>

                        {plugin.enabled ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] px-2.5 py-0.5 flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Terhubung Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground text-[11px] px-2.5 py-0.5"
                          >
                            Belum Aktif
                          </Badge>
                        )}
                      </div>

                      <div>
                        <h3 className="font-bold text-base text-slate-800">{plugin.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {plugin.description}
                        </p>
                      </div>

                      {plugin.id === "lincah" && plugin.enabled && (
                        <div className="bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-lg text-xs space-y-1 font-mono">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Partner ID:</span>
                            <span className="font-bold text-foreground">
                              {plugin.config.partnerId
                                ? `${plugin.config.partnerId.slice(0, 10)}...`
                                : "-"}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Mode Server:</span>
                            <span
                              className={cn(
                                "font-bold uppercase",
                                plugin.config.env === "production"
                                  ? "text-emerald-600"
                                  : "text-amber-600",
                              )}
                            >
                              {plugin.config.env || "development"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        {plugin.category}
                      </span>
                      <Button
                        size="sm"
                        variant={plugin.enabled ? "default" : "outline"}
                        className="h-8 text-xs font-semibold"
                        onClick={() => openSetupModal(plugin)}
                      >
                        <Settings className="size-3.5 mr-1.5" /> Setup Integrasi
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ════════ TAB 2: HEALTH MONITOR ════════ */}
        <TabsContent value="health" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Live Health & Connection Status</h2>
              <p className="text-xs text-muted-foreground">
                Monitoring status responsivitas server middleware dan koneksi OpenAPI pihak ketiga.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchHealth()}
              disabled={loadingHealth}
              className="gap-2 text-xs"
            >
              <RefreshCw className={cn("size-3.5", loadingHealth && "animate-spin")} />
              <span>Ping Ulang Koneksi</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {health?.services?.map((svc) => (
              <Card key={svc.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Server className="size-5" />
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px] font-bold uppercase",
                      svc.status === "operational" && "bg-emerald-600 text-white",
                      svc.status === "degraded" && "bg-amber-500 text-white",
                      svc.status === "down" && "bg-destructive text-white",
                      svc.status === "disabled" && "bg-slate-200 text-slate-700",
                    )}
                  >
                    {svc.status}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-800">{svc.name}</h4>
                  <p className="text-[11px] text-muted-foreground">{svc.type}</p>
                </div>

                <div className="pt-2 border-t text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Latency Response:</span>
                    <span className="font-mono font-bold text-foreground">{svc.latencyMs} ms</span>
                  </div>
                  {svc.id === "lincah" && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Environment:</span>
                        <span className="font-mono font-bold uppercase text-indigo-600">
                          {svc.env}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Saldo Deposit:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          Rp {(svc.balance ?? 0).toLocaleString("id-ID")}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {svc.error && (
                  <div className="bg-red-50 text-red-700 p-2 rounded text-[11px] font-mono leading-tight">
                    ⚠️ {svc.error}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ════════ TAB 3: API PLAYGROUND / SANDBOX ════════ */}
        <TabsContent value="playground" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Request Builder */}
            <Card className="lg:col-span-5 p-6 space-y-4">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Terminal className="size-4 text-primary" /> API Request Tester Sandbox
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Uji coba eksekusi API langsung melalui Platform Middleware MAULARIS.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold">Pilih Action Endpoint Middleware</Label>
                  <Select
                    value={pgAction}
                    onValueChange={(v: any) => {
                      setPgAction(v);
                      setPgResult(null);
                    }}
                  >
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lincah_me">Lincah: Cek Auth & Balance (/me)</SelectItem>
                      <SelectItem value="lincah_search_district">
                        Lincah: Cari Kecamatan (/district/search)
                      </SelectItem>
                      <SelectItem value="lincah_ongkir">
                        Lincah: Hitung Ongkir Aggregator (/ongkir)
                      </SelectItem>
                      <SelectItem value="whatsapp_send_test">
                        WhatsApp: Kirim Pesan Uji Coba
                      </SelectItem>
                      <SelectItem value="webhook_test_trigger">
                        Webhook: Dispatch Payload Test
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic Inputs based on Action */}
                {pgAction === "lincah_search_district" && (
                  <div>
                    <Label className="text-xs font-semibold">Kata Kunci Kecamatan / Kota</Label>
                    <Input
                      className="mt-1 text-xs font-mono"
                      value={pgParams.q || ""}
                      onChange={(e) => setPgParams({ ...pgParams, q: e.target.value })}
                      placeholder="cth. Semarang, Bandung"
                    />
                  </div>
                )}

                {pgAction === "lincah_ongkir" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs font-semibold">Kode Kecamatan Asal (Origin)</Label>
                      <Input
                        className="mt-1 text-xs font-mono"
                        value={pgParams.origin_code || ""}
                        onChange={(e) => setPgParams({ ...pgParams, origin_code: e.target.value })}
                        placeholder="33.72.01"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        Kode Kecamatan Tujuan (Destination)
                      </Label>
                      <Input
                        className="mt-1 text-xs font-mono"
                        value={pgParams.destination_code || ""}
                        onChange={(e) =>
                          setPgParams({ ...pgParams, destination_code: e.target.value })
                        }
                        placeholder="31.71.01"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Berat Paket (Gram)</Label>
                      <Input
                        type="number"
                        className="mt-1 text-xs font-mono"
                        value={pgParams.weight_g || 1000}
                        onChange={(e) =>
                          setPgParams({ ...pgParams, weight_g: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                )}

                {pgAction === "whatsapp_send_test" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs font-semibold">Nomor WhatsApp Tujuan</Label>
                      <Input
                        className="mt-1 text-xs font-mono"
                        value={pgParams.phone || ""}
                        onChange={(e) => setPgParams({ ...pgParams, phone: e.target.value })}
                        placeholder="081234567890"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Pesan Notifikasi</Label>
                      <Textarea
                        className="mt-1 text-xs font-mono"
                        rows={3}
                        value={pgParams.message || ""}
                        onChange={(e) => setPgParams({ ...pgParams, message: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {pgAction === "webhook_test_trigger" && (
                  <div>
                    <Label className="text-xs font-semibold">Target Webhook URL</Label>
                    <Input
                      className="mt-1 text-xs font-mono"
                      value={pgParams.url || ""}
                      onChange={(e) => setPgParams({ ...pgParams, url: e.target.value })}
                      placeholder="https://n8n.example.com/webhook/orders"
                    />
                  </div>
                )}
              </div>

              <Button
                className="w-full font-semibold gap-2"
                onClick={() => playgroundMutation.mutate()}
                disabled={playgroundMutation.isPending}
              >
                {playgroundMutation.isPending ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Executing Middleware Request...
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" /> Jalankan API Request
                  </>
                )}
              </Button>
            </Card>

            {/* Response JSON Inspector */}
            <Card className="lg:col-span-7 p-6 space-y-4 bg-slate-950 text-slate-100 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Code className="size-4 text-emerald-400" />
                  <span>Response Output JSON</span>
                </div>

                {pgResult && (
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "text-[10px] font-bold font-mono",
                        pgResult.success ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
                      )}
                    >
                      HTTP {pgResult.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-slate-300 border-slate-700"
                    >
                      {pgResult.latencyMs} ms
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(pgResult, null, 2));
                        setPgCopySuccess(true);
                        setTimeout(() => setPgCopySuccess(false), 2000);
                      }}
                    >
                      {pgCopySuccess ? (
                        <Check className="size-3 text-emerald-400" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <div className="min-h-[300px] max-h-[500px] overflow-y-auto text-xs leading-relaxed text-slate-300">
                {playgroundMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center h-64 space-y-3 text-slate-500">
                    <RefreshCw className="size-6 animate-spin text-emerald-400" />
                    <span>Menghubungi middleware & upstream server...</span>
                  </div>
                ) : pgResult ? (
                  <pre className="whitespace-pre-wrap font-mono">
                    {JSON.stringify(pgResult, null, 2)}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 space-y-2 text-slate-500 text-center">
                    <Terminal className="size-8 opacity-30 text-emerald-400" />
                    <p>
                      Tekan tombol "Jalankan API Request" di sebelah kiri untuk menguji response API
                      secara live.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ════════ TAB 4: AUDIT & REQUEST LOGS ════════ */}
        <TabsContent value="logs" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Select value={logFilterStatus} onValueChange={setLogFilterStatus}>
                <SelectTrigger className="w-36 text-xs">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="success">Sukses (2xx)</SelectItem>
                  <SelectItem value="error">Error (4xx / 5xx)</SelectItem>
                </SelectContent>
              </Select>

              <Input
                className="text-xs max-w-xs"
                placeholder="Cari endpoint / service..."
                value={logSearchQ}
                onChange={(e) => setLogSearchQ(e.target.value)}
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchLogs()}
              className="gap-1.5 text-xs self-end sm:self-auto"
            >
              <RefreshCw className={cn("size-3.5", loadingLogs && "animate-spin")} /> Refetch Logs
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/70 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Method & Endpoint</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        Belum ada log request transaksi middleware yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString("id-ID")}
                        </td>
                        <td className="py-3 px-4 font-bold uppercase text-slate-800">
                          <Badge variant="outline" className="text-[10px]">
                            {log.service}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono truncate max-w-xs" title={log.endpoint}>
                          <span className="font-bold text-primary mr-1">{log.method}</span>{" "}
                          {log.endpoint}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={cn(
                              "text-[10px] font-mono",
                              log.success ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
                            )}
                          >
                            {log.status === 0 ? "NETWORK ERR" : log.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{log.latencyMs} ms</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setSelectedLog(log)}
                          >
                            Inspect Payload
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ════════ TAB 5: DOKUMENTASI & CURL ════════ */}
        <TabsContent value="docs" className="mt-6 space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold">Spesifikasi Middleware & cURL Generator</h3>
              <p className="text-xs text-muted-foreground">
                Gunakan cURL snippet di bawah untuk menghubungkan aplikasi eksternal atau script
                kustom dengan API Gateway middleware Anda.
              </p>
            </div>

            <div className="space-y-6">
              {apiDocs?.endpoints?.map((ep, idx) => (
                <Card key={idx} className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-600 text-white font-mono">{ep.method}</Badge>
                      <span className="font-bold text-sm font-mono">{ep.path}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-semibold">{ep.name}</span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">{ep.description}</p>

                  <div className="relative bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                      onClick={() => {
                        navigator.clipboard.writeText(ep.curl);
                        toast.success("cURL snippet berhasil disalin!");
                      }}
                    >
                      <Copy className="size-3 mr-1" /> Copy cURL
                    </Button>
                    <pre className="whitespace-pre-wrap">{ep.curl}</pre>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ SETUP INTEGRATION MODAL DIALOG ═══ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Plug className="size-5 text-primary" />
              Setup Integrasi: {selectedPlugin?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Konfigurasikan kunci API Key, Partner ID, kredensial toko, dan pengaturan integrasi
              platform ini.
            </DialogDescription>
          </DialogHeader>

          {selectedPlugin && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4 py-2"
            >
              {/* TOGGLE ENABLE STATUS */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <div className="text-sm font-semibold">Status Integrasi Middleware</div>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan atau nonaktifkan integrasi platform ini
                  </p>
                </div>
                <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              </div>

              {/* LINCAH.ID FIELDS */}
              {selectedPlugin.id === "lincah" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Lincah API Key / Token</Label>
                    <Input
                      type="password"
                      className="mt-1 font-mono text-xs"
                      value={formConfig.apiKey ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, apiKey: e.target.value })}
                      placeholder="oYeiIJkYFMct..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">
                      Partner ID (Wajib untuk OpenAPI)
                    </Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.partnerId ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, partnerId: e.target.value })}
                      placeholder="6a4617ceb8fd..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Environment Mode Server</Label>
                    <Select
                      value={formConfig.env ?? "development"}
                      onValueChange={(v) => setFormConfig({ ...formConfig, env: v })}
                    >
                      <SelectTrigger className="mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="development">
                          Sandbox / Development (dev-api.lincah.id)
                        </SelectItem>
                        <SelectItem value="production">
                          Production / Live (api.lincah.id)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* WHATSAPP GATEWAY FIELDS */}
              {selectedPlugin.id === "whatsapp" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Provider WhatsApp Gateway</Label>
                    <Select
                      value={formConfig.provider ?? "fonnte"}
                      onValueChange={(v) => setFormConfig({ ...formConfig, provider: v })}
                    >
                      <SelectTrigger className="mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fonnte">Fonnte (fonnte.com)</SelectItem>
                        <SelectItem value="wablas">Wablas (wablas.com)</SelectItem>
                        <SelectItem value="custom">Custom WA Gateway REST API</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">API Key / Token WA Gateway</Label>
                    <Input
                      type="password"
                      className="mt-1 font-mono text-xs"
                      value={formConfig.apiKey ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, apiKey: e.target.value })}
                      placeholder="Ketikkan token API WA gateway..."
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">
                      Nomor HP Pengirim (Sender Number)
                    </Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.senderPhone ?? ""}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, senderPhone: e.target.value })
                      }
                      placeholder="081234567890"
                    />
                  </div>
                </div>
              )}

              {/* SHOPEE FIELDS */}
              {selectedPlugin.id === "shopee" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Shopee Shop ID</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.shopId ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, shopId: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Partner ID</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.partnerId ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, partnerId: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Secret Key</Label>
                    <Input
                      type="password"
                      className="mt-1 font-mono text-xs"
                      value={formConfig.secretKey ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, secretKey: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* TIKTOK FIELDS */}
              {selectedPlugin.id === "tiktok" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">TikTok Shop App Key</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.appKey ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, appKey: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">App Secret</Label>
                    <Input
                      type="password"
                      className="mt-1 font-mono text-xs"
                      value={formConfig.appSecret ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, appSecret: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* TOKOPEDIA FIELDS */}
              {selectedPlugin.id === "tokopedia" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Tokopedia FS ID</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.fsId ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, fsId: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Client ID</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.clientId ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, clientId: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* WEBHOOK FIELDS */}
              {selectedPlugin.id === "webhook" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">
                      Target Webhook URL (n8n / Make / Custom)
                    </Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.url ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, url: e.target.value })}
                      placeholder="https://your-server.com/webhook/orders"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Secret Token Header</Label>
                    <Input
                      type="password"
                      className="mt-1 font-mono text-xs"
                      value={formConfig.secret ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, secret: e.target.value })}
                      placeholder="whsec_..."
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Menyimpan..." : "Simpan Integrasi"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ LOG INSPECT DIALOG MODAL ═══ */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-mono">
              <FileText className="size-5 text-primary" />
              Detail Request Log #{selectedLog?.id}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Melihat payload request dan response JSON yang diproses oleh middleware.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    Service & Endpoint
                  </span>
                  <span className="font-bold">
                    {selectedLog.service.toUpperCase()} - {selectedLog.endpoint}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Status & Latency</span>
                  <span className="font-bold">
                    {selectedLog.status} ({selectedLog.latencyMs} ms)
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Request Payload</Label>
                <div className="mt-1 bg-slate-950 text-slate-100 p-3 rounded-lg overflow-x-auto text-[11px]">
                  <pre>{JSON.stringify(selectedLog.requestPayload ?? {}, null, 2)}</pre>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Response Output / Error</Label>
                <div className="mt-1 bg-slate-950 text-slate-100 p-3 rounded-lg overflow-x-auto text-[11px]">
                  <pre>
                    {selectedLog.error
                      ? JSON.stringify({ error: selectedLog.error }, null, 2)
                      : JSON.stringify(selectedLog.responsePayload ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
