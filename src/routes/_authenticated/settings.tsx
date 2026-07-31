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
        active_couriers: updated,
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
        lincah_couriers: updated,
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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-muted-foreground text-sm mt-1">Info pengirim, gudang, Lincah.id API, & pemilahan ekspedisi terintegrasi</p>
      </div>

      {/* Pengaturan Lincah.id Platform */}
      <Card className="p-5 space-y-4 border-primary/20 bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Pengaturan Lincah.id API</h2>
              <p className="text-xs text-muted-foreground">Kredensial API Key & Partner ID dapat disesuaikan bebas di sini</p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${form.lincah_env === "production" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"}`}>
            {form.lincah_env === "production" ? "Production" : "Sandbox (Development)"}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold">API Key / Token</Label>
            <Input
              value={form.lincah_api_key}
              onChange={(e) => setForm({ ...form, lincah_api_key: e.target.value })}
              placeholder="Masukkan API Key Lincah.id..."
              className="mt-1 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Diperoleh dari Profile Settings → Open API di Lincah</p>
          </div>
          <div>
            <Label className="text-xs font-semibold">Partner ID</Label>
            <Input
              value={form.lincah_partner_id}
              onChange={(e) => setForm({ ...form, lincah_partner_id: e.target.value })}
              placeholder="Masukkan Partner ID Lincah.id..."
              className="mt-1 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Partner ID dari Dashboard Lincah</p>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold">Lingkungan API (Environment)</Label>
          <div className="mt-1.5 flex gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, lincah_env: "development" })}
              className={`flex-1 py-2 px-3 text-xs rounded-md border text-center transition-all ${form.lincah_env === "development" ? "border-amber-500 bg-amber-500/10 font-semibold text-amber-700 dark:text-amber-400" : "hover:bg-accent"}`}
            >
              🛠️ Sandbox / Development (`dev-api.lincah.id`)
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, lincah_env: "production" })}
              className={`flex-1 py-2 px-3 text-xs rounded-md border text-center transition-all ${form.lincah_env === "production" ? "border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-400" : "hover:bg-accent"}`}
            >
              🚀 Production (`api.lincah.id`)
            </button>
          </div>
        </div>

        <div className="pt-2 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestLincah}
            disabled={testingConnection}
            className="gap-2"
          >
            {testingConnection ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-500" />
            )}
            {testingConnection ? "Memeriksa Koneksi..." : "Cek Koneksi & Saldo Lincah"}
          </Button>

          {lincahStatus.tested && lincahStatus.success && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="size-4 shrink-0" />
              <div>
                <span>Terhubung: {lincahStatus.user?.name || lincahStatus.user?.email}</span>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 font-mono text-[11px]">
                  Saldo: {formatIDR(lincahStatus.balance ?? 0)}
                </span>
              </div>
            </div>
          )}

          {lincahStatus.tested && !lincahStatus.success && (
            <div className="flex items-center gap-2 text-xs text-destructive font-medium bg-destructive/10 p-2 rounded border border-destructive/20">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Gagal: {lincahStatus.error}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Ekspedisi Terintegrasi Lincah.id */}
      <Card className="p-5 space-y-4 border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
            <Zap className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Ekspedisi Terintegrasi Lincah.id (Otomatis)</h2>
            <p className="text-xs text-muted-foreground">
              Mendukung fitur Booking Penjemputan Otomatis, Resi Instant, dan Tracking Real-Time via Lincah.id API.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
          {lincahAvailableList.map((c: any) => {
            const code = c.code.toLowerCase();
            const on = form.lincah_couriers.includes(code);
            return (
              <label
                key={code}
                className={`flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all ${on ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-medium" : "hover:bg-accent opacity-75"}`}
              >
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => toggleLincahCourier(code, !!v)}
                />
                <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                  {c.image ? (
                    <img src={c.image} alt={c.name} className="size-5 object-contain shrink-0" />
                  ) : (
                    <Truck className="size-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-xs">{c.name || COURIER_LABEL[code] || code.toUpperCase()}</span>
                </div>
              </label>
            );
          })}
        </div>
      </Card>

      {/* Ekspedisi Non-Lincah / Manual */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-muted text-muted-foreground">
            <SlidersHorizontal className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Ekspedisi Non-Lincah / Manual (Direct)</h2>
            <p className="text-xs text-muted-foreground">
              Ekspedisi standar (Input manual & nomor resi manual).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          {COURIERS.map((c) => {
            const on = form.active_couriers.includes(c);
            return (
              <label key={c} className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-accent ${on ? "border-primary font-medium" : "opacity-75"}`}>
                <Checkbox checked={on} onCheckedChange={(v) => toggleNonLincahCourier(c, !!v)} />
                <span className="text-xs">{COURIER_LABEL[c]}</span>
              </label>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Pengirim (dicetak pada label)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Nama bisnis / pengirim</Label><Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} /></div>
          <div><Label>Telepon</Label><Input value={form.sender_phone} onChange={(e) => setForm({ ...form, sender_phone: e.target.value })} /></div>
          <div><Label>Kota</Label><Input value={form.sender_city} onChange={(e) => setForm({ ...form, sender_city: e.target.value })} /></div>
          <div><Label>URL Logo (opsional)</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
        </div>
        <div><Label>Alamat</Label><Textarea rows={2} value={form.sender_address} onChange={(e) => setForm({ ...form, sender_address: e.target.value })} /></div>
        <div>
          <Label>Satuan berat</Label>
          <div className="mt-1 flex gap-2">
            {(["g", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setForm({ ...form, weight_unit: u })}
                className={`px-4 py-2 text-sm rounded-md border ${form.weight_unit === u ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent"}`}
              >
                {u === "g" ? "Gram (g)" : "Kilogram (kg)"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Menentukan satuan input & tampilan berat di seluruh sistem. Data disimpan tetap dalam gram.
          </p>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Asal pengiriman (Gudang Utama)</h2>
        <p className="text-sm text-muted-foreground">
          Cari kecamatan asal gudang. Digunakan untuk perhitungan ongkir otomatis.
        </p>
        <div>
          <Label>Asal gudang</Label>
          {form.origin_subdistrict_id ? (
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{form.origin_label}</div>
                <div className="text-xs text-muted-foreground">ID: {form.origin_subdistrict_id}</div>
              </div>
              <Button type="button" size="sm" variant="ghost"
                onClick={() => setForm((f) => ({ ...f, origin_subdistrict_id: "", origin_label: "" }))}>
                Ganti
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Input
                placeholder="Ketikan minimal 3 huruf awal kecamatan..."
                value={originQ}
                onChange={(e) => setOriginQ(e.target.value)}
                className="rounded-none border-0 border-b focus-visible:ring-0"
              />
              <div className="max-h-72 overflow-auto">
                {(originResults.data ?? []).map((d: Destination) => (
                  <button key={d.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => { setForm((f) => ({ ...f, origin_subdistrict_id: d.id, origin_label: d.label })); setOriginQ(""); }}>
                    <div className="font-medium">{d.district_name || d.subdistrict_name}, {d.city_name}</div>
                    <div className="text-xs text-muted-foreground">{d.province_name} {d.zip_code ? `· ${d.zip_code}` : ""}</div>
                  </button>

                ))}
                {originQ.trim().length >= 3 && !originResults.isLoading && (originResults.data?.length ?? 0) === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">Tidak ada hasil</div>
                )}
                {originQ.trim().length < 3 && (
                  <div className="p-3 text-sm text-muted-foreground">Ketik minimal 3 huruf…</div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Ekspedisi Custom</h2>
            <p className="text-sm text-muted-foreground">Kurir manual (mis. ojek, kurir toko) dengan tarif tetap.</p>
          </div>
          <Button size="sm" variant="outline" onClick={addCustom}><Plus className="size-4 mr-1" />Tambah</Button>
        </div>
        {form.custom_couriers.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Belum ada ekspedisi custom</p>
        )}
        <div className="space-y-2">
          {form.custom_couriers.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3">
              <div className="col-span-12 sm:col-span-4">
                <Label className="text-xs">Nama</Label>
                <Input value={c.name} placeholder="mis. Kurir Toko" onChange={(e) => updateCustom(i, { name: e.target.value })} />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Label className="text-xs">Harga (Rp)</Label>
                <Input type="number" value={c.price} onChange={(e) => updateCustom(i, { price: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground mt-1">{formatIDR(c.price)}</p>
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Label className="text-xs">Estimasi (hari)</Label>
                <Input value={c.etd ?? ""} onChange={(e) => updateCustom(i, { etd: e.target.value })} placeholder="1-2" />
              </div>
              <div className="col-span-10 sm:col-span-2">
                <Label className="text-xs">Keterangan</Label>
                <Input value={c.description ?? ""} onChange={(e) => updateCustom(i, { description: e.target.value })} placeholder="Same-day" />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => removeCustom(i)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
      </div>
    </div>
  );
}
