import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/lib/settings.functions";
import { searchDestinations, type Destination } from "@/lib/shipping.functions";
import { checkLincahConnection, getLincahCouriers } from "@/lib/lincah.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, CheckCircle2, ShieldAlert, RefreshCw, KeyRound, Truck, Zap, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { COURIERS, COURIER_LABEL, formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type CustomCourier = { name: string; price: number; description?: string; etd?: string };

const ALL_AVAILABLE_COURIERS = [
  { code: "jne", name: "JNE Express" },
  { code: "sap", name: "SAP Express" },
  { code: "ninja", name: "Ninja Express" },
  { code: "sicepat", name: "SiCepat Express" },
  { code: "jnt", name: "J&T Express" },
  { code: "anteraja", name: "AnterAja" },
  { code: "lion", name: "Lion Parcel" },
  { code: "ide", name: "ID Express" },
  { code: "pos", name: "Pos Indonesia" },
  { code: "wahana", name: "Wahana" },
  { code: "tiki", name: "TIKI" },
];

function SettingsPage() {
  const fetch = useServerFn(getSettings);
  const update = useServerFn(updateSettings);
  const searchDest = useServerFn(searchDestinations);
  const testLincah = useServerFn(checkLincahConnection);
  const fetchLincahCouriers = useServerFn(getLincahCouriers);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => fetch() });

  const lincahCouriersQ = useQuery({
    queryKey: ["lincah-couriers"],
    queryFn: () => fetchLincahCouriers(),
    staleTime: 5 * 60_000,
  });

  const [form, setForm] = useState({
    sender_name: "",
    sender_phone: "",
    sender_city: "",
    sender_address: "",
    origin_subdistrict_id: "",
    origin_label: "",
    logo_url: "",
    active_couriers: [...COURIERS] as string[],
    lincah_couriers: ["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana"] as string[],
    custom_couriers: [] as CustomCourier[],
    weight_unit: "g" as "g" | "kg",
    lincah_api_key: "oYeiIJkYFMctQebMQOZfOJYNbHkUzShD",
    lincah_partner_id: "6a4617ceb8fd8dd8aa41906e",
    lincah_env: "development" as "development" | "production",
    label_paper_size: "100x150" as "100x100" | "100x150",
  });

  const [lincahStatus, setLincahStatus] = useState<{
    tested: boolean;
    success?: boolean;
    user?: { name?: string; email?: string; phone?: string };
    balance?: number;
    error?: string;
  }>({ tested: false });

  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        sender_name: data.sender_name,
        sender_phone: data.sender_phone,
        sender_city: data.sender_city,
        sender_address: data.sender_address,
        origin_subdistrict_id: data.origin_subdistrict_id ?? "",
        origin_label: data.origin_label ?? "",
        logo_url: data.logo_url ?? "",
        active_couriers: (data as any).active_couriers ?? [...COURIERS],
        lincah_couriers: (data as any).lincah_couriers ?? ["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana"],
        custom_couriers: (data as any).custom_couriers ?? [],
        weight_unit: (data as any).weight_unit === "kg" ? "kg" : "g",
        lincah_api_key: (data as any).lincah_api_key ?? "oYeiIJkYFMctQebMQOZfOJYNbHkUzShD",
        lincah_partner_id: (data as any).lincah_partner_id ?? "6a4617ceb8fd8dd8aa41906e",
        lincah_env: (data as any).lincah_env === "production" ? "production" : "development",
        label_paper_size: (data as any).label_paper_size === "100x100" ? "100x100" : "100x150",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      update({
        data: { ...form, logo_url: form.logo_url || null },
      }),
    onSuccess: (res: any) => {
      if (res?.warning) {
        toast.warning(res.warning, { duration: 6000 });
      } else {
        toast.success("Pengaturan disimpan");
      }
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan"),
  });

  async function handleTestLincah() {
    setTestingConnection(true);
    setLincahStatus({ tested: false });
    try {
      const res = await testLincah();
      if (res.success) {
        setLincahStatus({
          tested: true,
          success: true,
          user: res.user,
          balance: res.balance,
        });
        toast.success(`Koneksi Lincah.id Berhasil! Akun: ${res.user?.name || res.user?.email || 'OK'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Koneksi ke Lincah.id gagal";
      setLincahStatus({
        tested: true,
        success: false,
        error: msg,
      });
      toast.error(`Koneksi Lincah.id Gagal: ${msg}`);
    } finally {
      setTestingConnection(false);
    }
  }

  const [originQ, setOriginQ] = useState("");
  const originResults = useQuery({
    queryKey: ["destinations", "origin", originQ],
    queryFn: () => searchDest({ data: { q: originQ, limit: 15 } }),
    enabled: originQ.trim().length >= 3 && !form.origin_subdistrict_id,
    staleTime: 60_000,
  });

  function toggleLincahCourier(code: string, on: boolean) {
    setForm((f) => {
      const updated = on
        ? Array.from(new Set([...f.lincah_couriers, code]))
        : f.lincah_couriers.filter((c) => c !== code);
      return {
        ...f,
        lincah_couriers: updated,
      };
    });
  }

  function toggleNonLincahCourier(code: string, on: boolean) {
    setForm((f) => {
      const updated = on
        ? Array.from(new Set([...f.active_couriers, code]))
        : f.active_couriers.filter((c) => c !== code);
      return {
        ...f,
        active_couriers: updated,
      };
    });
  }

  function addCustom() {
    setForm((f) => ({
      ...f,
      custom_couriers: [...f.custom_couriers, { name: "", price: 0, description: "", etd: "-" }],
    }));
  }
  function updateCustom(idx: number, patch: Partial<CustomCourier>) {
    setForm((f) => ({
      ...f,
      custom_couriers: f.custom_couriers.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  }
  function removeCustom(idx: number) {
    setForm((f) => ({ ...f, custom_couriers: f.custom_couriers.filter((_, i) => i !== idx) }));
  }

  if (isLoading) return <Skeleton className="h-96" />;

  const lincahAvailableList = lincahCouriersQ.data && lincahCouriersQ.data.length ? lincahCouriersQ.data : ALL_AVAILABLE_COURIERS;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pengaturan OMS</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pengaturan umum toko, identitas pengirim pada label, Lincah.id API, dan kurir custom.
        </p>
      </div>

      {/* Profil Pengguna Card Banner */}
      <Card className="p-4 bg-gradient-to-r from-primary/10 via-background to-accent/20 border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary text-primary-foreground font-bold text-sm grid place-items-center">
            {form.sender_name ? form.sender_name.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <div className="font-bold text-sm">Profil Akun & Toko</div>
            <div className="text-xs text-muted-foreground">
              {form.sender_name || "Akun Pengguna"} • {form.sender_phone || "Belum ada telp"}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/profile">Lihat Profil Lengkap</a>
        </Button>
      </Card>

      {/* Identitas Pengirim & Toko */}
      <Card className="p-5 space-y-4 shadow-sm border-border">
        <h2 className="font-semibold text-base">Identitas Pengirim & Toko</h2>
        <p className="text-xs text-muted-foreground">Informasi ini dicetak pada label pengiriman pesanan.</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold">Nama Toko / Pengirim</Label>
            <Input
              value={form.sender_name}
              onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
              placeholder="cth. Maularis Official Store"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Telepon Pengirim</Label>
            <Input
              value={form.sender_phone}
              onChange={(e) => setForm({ ...form, sender_phone: e.target.value })}
              placeholder="081234567890"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Kota Pengirim</Label>
            <Input
              value={form.sender_city}
              onChange={(e) => setForm({ ...form, sender_city: e.target.value })}
              placeholder="cth. Surakarta"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">URL Logo Toko (Opsional)</Label>
            <Input
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold">Alamat Lengkap Pengirim</Label>
          <Textarea
            rows={2}
            value={form.sender_address}
            onChange={(e) => setForm({ ...form, sender_address: e.target.value })}
            placeholder="Alamat fisik pengirim..."
          />
        </div>

        <div>
          <Label className="text-xs font-semibold">Satuan Berat Sistem</Label>
          <div className="mt-1 flex gap-2">
            {(["g", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setForm({ ...form, weight_unit: u })}
                className={`px-4 py-2 text-xs rounded-md border transition-all ${
                  form.weight_unit === u ? "border-primary bg-primary/5 font-semibold text-primary" : "hover:bg-accent text-muted-foreground"
                }`}
              >
                {u === "g" ? "Gram (g)" : "Kilogram (kg)"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold">Ukuran Kertas Label Pengiriman (Default)</Label>
          <div className="mt-1 flex gap-2">
            {(["100x150", "100x100"] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setForm({ ...form, label_paper_size: sz })}
                className={`px-4 py-2 text-xs rounded-md border transition-all ${
                  form.label_paper_size === sz ? "border-primary bg-primary/5 font-semibold text-primary" : "hover:bg-accent text-muted-foreground"
                }`}
              >
                {sz === "100x150" ? "📄 Thermal 100 × 150 mm (Standar)" : "📄 Thermal 100 × 100 mm (Square)"}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Pengaturan Lincah.id API */}
      <Card className="p-5 space-y-4 border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Kredensial Lincah.id Open API</h2>
              <p className="text-xs text-muted-foreground">Digunakan untuk Booking Penjemputan, Cek Ongkir, & Resi Instant</p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${form.lincah_env === "production" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"}`}>
            {form.lincah_env === "production" ? "Production" : "Sandbox"}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold">API Key / Token</Label>
            <Input
              value={form.lincah_api_key}
              onChange={(e) => setForm({ ...form, lincah_api_key: e.target.value })}
              className="mt-1 font-mono text-xs"
              placeholder="Masukkan API Key Lincah..."
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Partner ID</Label>
            <Input
              value={form.lincah_partner_id}
              onChange={(e) => setForm({ ...form, lincah_partner_id: e.target.value })}
              className="mt-1 font-mono text-xs"
              placeholder="Masukkan Partner ID Lincah..."
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold">Environment / Server API</Label>
          <div className="mt-1.5 grid sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setForm({ ...form, lincah_env: "development" })}
              className={`p-3 rounded-lg border text-left transition-all ${
                form.lincah_env === "development"
                  ? "border-amber-500 bg-amber-500/10 font-semibold text-amber-900 dark:text-amber-300 shadow-xs"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <div className="text-xs font-bold">🛠️ Sandbox (Development)</div>
              <div className="text-[11px] font-mono mt-0.5 opacity-80">https://dev-api.lincah.id/openapi</div>
            </button>

            <button
              type="button"
              onClick={() => setForm({ ...form, lincah_env: "production" })}
              className={`p-3 rounded-lg border text-left transition-all ${
                form.lincah_env === "production"
                  ? "border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-900 dark:text-emerald-300 shadow-xs"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <div className="text-xs font-bold">🚀 Production (Live)</div>
              <div className="text-[11px] font-mono mt-0.5 opacity-80">https://api.lincah.id/openapi</div>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestLincah}
            disabled={testingConnection}
            className="text-xs"
          >
            {testingConnection ? "Memeriksa..." : "Uji Koneksi Lincah.id"}
          </Button>

          {lincahStatus.tested && lincahStatus.success && (
            <span className="text-xs text-emerald-600 font-medium">
              ✓ Terhubung ({formatIDR(lincahStatus.balance ?? 0)})
            </span>
          )}
        </div>
      </Card>

      {/* Jasa Kirim Aktif */}
      <Card className="p-5 space-y-4 shadow-sm border-sky-500/20 bg-sky-50/10 dark:bg-sky-950/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
              <Truck className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Jasa Kirim Aktif</h2>
              <p className="text-xs text-muted-foreground">Aktifkan ekspedisi yang ingin ditampilkan saat input pesanan & cek ongkir.</p>
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {form.lincah_couriers.length}/{lincahAvailableList.length} aktif
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {lincahAvailableList.map((c) => {
            const isActive = form.lincah_couriers.includes(c.code);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleLincahCourier(c.code, !isActive)}
                className={`relative p-3 rounded-lg border text-left text-xs transition-all ${
                  isActive
                    ? "border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-200 font-semibold shadow-xs"
                    : "border-border/60 text-muted-foreground hover:bg-accent opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase">{c.code}</span>
                  <div className={`w-8 h-4 rounded-full flex items-center transition-all ${isActive ? "bg-sky-500 justify-end" : "bg-muted justify-start"}`}>
                    <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm mx-0.5" />
                  </div>
                </div>
                <div className="mt-0.5 text-[11px] opacity-80">{c.name}</div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setForm({ ...form, lincah_couriers: lincahAvailableList.map(c => c.code) })}
          >
            Aktifkan Semua
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setForm({ ...form, lincah_couriers: [] })}
          >
            Nonaktifkan Semua
          </Button>
        </div>
      </Card>

      {/* Ekspedisi Custom */}
      <Card className="p-5 space-y-4 shadow-sm border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">Ekspedisi Custom / Manual</h2>
            <p className="text-xs text-muted-foreground">Kurir khusus toko (mis. Kurir Internal, Ojek Online) dengan tarif tetap.</p>
          </div>
          <Button size="sm" variant="outline" onClick={addCustom} className="text-xs">
            <Plus className="size-3.5 mr-1" /> Tambah
          </Button>
        </div>

        {form.custom_couriers.length === 0 && (
          <p className="text-xs text-muted-foreground py-3 text-center">Belum ada ekspedisi custom ditambahkan</p>
        )}

        <div className="space-y-2">
          {form.custom_couriers.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3">
              <div className="col-span-12 sm:col-span-4">
                <Label className="text-xs font-semibold">Nama Ekspedisi</Label>
                <Input value={c.name} placeholder="cth. Kurir Toko Solo" onChange={(e) => updateCustom(i, { name: e.target.value })} className="text-xs" />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Label className="text-xs font-semibold">Ongkir (Rp)</Label>
                <Input type="number" value={c.price} onChange={(e) => updateCustom(i, { price: Number(e.target.value) })} className="text-xs font-mono" />
              </div>
              <div className="col-span-6 sm:col-span-4">
                <Label className="text-xs font-semibold">Keterangan</Label>
                <Input value={c.description ?? ""} onChange={(e) => updateCustom(i, { description: e.target.value })} placeholder="Same-day delivery" className="text-xs" />
              </div>
              <div className="col-span-12 sm:col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => removeCustom(i)} className="size-8 text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
