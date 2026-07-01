import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/lib/settings.functions";
import { searchDestinations, type Destination } from "@/lib/shipping.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { COURIERS, COURIER_LABEL, formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type CustomCourier = { name: string; price: number; description?: string; etd?: string };

function SettingsPage() {
  const fetch = useServerFn(getSettings);
  const update = useServerFn(updateSettings);
  const searchDest = useServerFn(searchDestinations);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => fetch() });

  const [form, setForm] = useState({
    sender_name: "",
    sender_phone: "",
    sender_city: "",
    sender_address: "",
    origin_subdistrict_id: "",
    origin_label: "",
    logo_url: "",
    active_couriers: [...COURIERS] as string[],
    custom_couriers: [] as CustomCourier[],
    weight_unit: "g" as "g" | "kg",
  });

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
        custom_couriers: (data as any).custom_couriers ?? [],
        weight_unit: ((data as any).weight_unit === "kg" ? "kg" : "g"),
      });
    }
  }, [data]);


  const save = useMutation({
    mutationFn: () =>
      update({
        data: { ...form, logo_url: form.logo_url || null },
      }),
    onSuccess: () => {
      toast.success("Pengaturan disimpan");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  const [originQ, setOriginQ] = useState("");
  const originResults = useQuery({
    queryKey: ["destinations", "origin", originQ],
    queryFn: () => searchDest({ data: { q: originQ, limit: 15 } }),
    enabled: originQ.trim().length >= 3 && !form.origin_subdistrict_id,
    staleTime: 60_000,
  });

  function toggleCourier(code: string, on: boolean) {
    setForm((f) => ({
      ...f,
      active_couriers: on
        ? Array.from(new Set([...f.active_couriers, code]))
        : f.active_couriers.filter((c) => c !== code),
    }));
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-muted-foreground text-sm mt-1">Info pengirim, gudang, & pilihan ekspedisi</p>
      </div>

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
        <h2 className="font-semibold">Asal pengiriman (RajaOngkir V2)</h2>
        <p className="text-sm text-muted-foreground">
          Cari kelurahan asal gudang. Hasil pencarian memakai RajaOngkir API V2 (subdistrict-level).
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
                placeholder="Ketik nama kelurahan/kecamatan/kota (min. 3 huruf)…"
                value={originQ}
                onChange={(e) => setOriginQ(e.target.value)}
                className="rounded-none border-0 border-b focus-visible:ring-0"
              />
              <div className="max-h-72 overflow-auto">
                {(originResults.data ?? []).map((d: Destination) => (
                  <button key={d.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => { setForm((f) => ({ ...f, origin_subdistrict_id: d.id, origin_label: d.label })); setOriginQ(""); }}>
                    <div className="font-medium">{d.subdistrict_name}, {d.district_name}</div>
                    <div className="text-xs text-muted-foreground">{d.city_name} · {d.province_name} · {d.zip_code}</div>
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
        <h2 className="font-semibold">Ekspedisi Aktif</h2>
        <p className="text-sm text-muted-foreground">Centang kurir yang akan ditampilkan saat pengecekan ongkir.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {COURIERS.map((c) => {
            const on = form.active_couriers.includes(c);
            return (
              <label key={c} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent">
                <Checkbox checked={on} onCheckedChange={(v) => toggleCourier(c, !!v)} />
                <span className="text-sm">{COURIER_LABEL[c]}</span>
              </label>
            );
          })}
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
