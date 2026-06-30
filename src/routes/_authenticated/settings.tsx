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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

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

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Sender info on labels & RajaOngkir origin</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Sender (printed on labels)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Nama bisnis / pengirim</Label><Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} /></div>
          <div><Label>Telepon</Label><Input value={form.sender_phone} onChange={(e) => setForm({ ...form, sender_phone: e.target.value })} /></div>
          <div><Label>Kota</Label><Input value={form.sender_city} onChange={(e) => setForm({ ...form, sender_city: e.target.value })} /></div>
          <div><Label>URL Logo (opsional)</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
        </div>
        <div><Label>Alamat</Label><Textarea rows={2} value={form.sender_address} onChange={(e) => setForm({ ...form, sender_address: e.target.value })} /></div>
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
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setForm((f) => ({ ...f, origin_subdistrict_id: "", origin_label: "" }))}
              >
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
                  <button
                    key={d.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => {
                      setForm((f) => ({ ...f, origin_subdistrict_id: d.id, origin_label: d.label }));
                      setOriginQ("");
                    }}
                  >
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
                {originResults.isLoading && (
                  <div className="p-3 text-sm text-muted-foreground">Mencari…</div>
                )}
                {originResults.error && (
                  <div className="p-3 text-sm text-destructive">
                    {originResults.error instanceof Error ? originResults.error.message : "Gagal mencari"}
                  </div>
                )}
              </div>
            </div>
          )}
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
