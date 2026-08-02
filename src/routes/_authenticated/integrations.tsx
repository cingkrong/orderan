import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getIntegrations, updateIntegrationConfig, IntegrationPlugin } from "@/lib/integrations.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsPage,
});

const ICON_MAP: Record<string, any> = {
  Truck,
  MessageSquare,
  ShoppingBag,
  Video,
  Store,
  Webhook,
};

function IntegrationsPage() {
  const queryClient = useQueryClient();
  const fetchPlugins = useServerFn(getIntegrations);
  const savePlugin = useServerFn(updateIntegrationConfig);

  const { data: plugins, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetchPlugins(),
  });

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<IntegrationPlugin | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Modal form config state
  const [formEnabled, setFormEnabled] = useState(false);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});

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
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan integrasi");
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

  return (
    <div className="space-y-6 pb-16">
      {/* HEADER PAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Integrasi Addons & Platform</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Hubungkan toko CRM Anda dengan ekspedisi, WhatsApp Gateway, marketplace, dan webhook otomatis.
          </p>
        </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full md:w-auto">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs">
              Semua ({allPlugins.length})
            </TabsTrigger>
            <TabsTrigger value="shipping" className="text-xs">
              Ekspedisi & Logistik
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs">
              Pesan & WhatsApp
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="text-xs">
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="webhook" className="text-xs">
              Webhook & API
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 text-xs"
            placeholder="Cari platform integrasi..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
      </div>

      {/* INTEGRATIONS GRID */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-60 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      ) : filteredPlugins.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm space-y-2">
          <Plug className="size-8 mx-auto opacity-40 text-primary" />
          <p>Tidak ada addon/integrasi ditemukan untuk kategori ini.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlugins.map((plugin) => {
            const IconComponent = ICON_MAP[plugin.iconName] || Puzzle;
            return (
              <Card
                key={plugin.id}
                className={cn(
                  "p-5 flex flex-col justify-between space-y-4 border transition-all hover:shadow-md",
                  plugin.enabled ? "border-emerald-500/40 bg-emerald-50/10" : "bg-card"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                      <IconComponent className="size-6" />
                    </div>

                    {plugin.enabled ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] px-2.5 py-0.5 flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Terhubung
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[11px] px-2.5 py-0.5">
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
                </div>

                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">
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

      {/* SETUP INTEGRATION DIALOG MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Plug className="size-5 text-primary" />
              Setup Integrasi: {selectedPlugin?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Konfigurasikan kunci API Key, kredensial toko, dan pengaturan integrasi platform ini.
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
                  <div className="text-sm font-semibold">Status Integrasi</div>
                  <p className="text-xs text-muted-foreground">Aktifkan integrasi platform ini</p>
                </div>
                <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              </div>

              {/* DYNAMIC PLUGIN FIELDS */}
              {selectedPlugin.id === "lincah" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Lincah API Key</Label>
                    <Input
                      type="password"
                      className="mt-1 font-mono text-xs"
                      value={formConfig.apiKey ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, apiKey: e.target.value })}
                      placeholder="oYeiIJkYFMct..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Partner ID</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.partnerId ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, partnerId: e.target.value })}
                      placeholder="6a4617ceb8fd..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Environment Mode</Label>
                    <Select
                      value={formConfig.env ?? "development"}
                      onValueChange={(v) => setFormConfig({ ...formConfig, env: v })}
                    >
                      <SelectTrigger className="mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="development">Sandbox / Development</SelectItem>
                        <SelectItem value="production">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

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
                    <Label className="text-xs font-semibold">Nomor HP Pengirim (Sender Number)</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.senderPhone ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, senderPhone: e.target.value })}
                      placeholder="081234567890"
                    />
                  </div>
                </div>
              )}

              {selectedPlugin.id === "shopee" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Shopee Shop ID</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.shopId ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, shopId: e.target.value })}
                      placeholder="cth. 12345678"
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
                  <div>
                    <Label className="text-xs font-semibold">Shop Cipher</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.shopCipher ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, shopCipher: e.target.value })}
                    />
                  </div>
                </div>
              )}

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
                  <div>
                    <Label className="text-xs font-semibold">Client Secret</Label>
                    <Input
                      type="password"
                      className="mt-1 font-mono text-xs"
                      value={formConfig.clientSecret ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, clientSecret: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {selectedPlugin.id === "webhook" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Target Webhook URL</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={formConfig.url ?? ""}
                      onChange={(e) => setFormConfig({ ...formConfig, url: e.target.value })}
                      placeholder="https://your-server.com/webhook/orders"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Secret Token (Authorization Header)</Label>
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
    </div>
  );
}
