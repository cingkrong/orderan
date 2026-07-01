import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listWarehouses, upsertWarehouse, deleteWarehouse, type WarehouseInput } from "@/lib/warehouses.functions";
import { searchDestinations, type Destination } from "@/lib/shipping.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Warehouse as WarehouseIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/warehouses")({
  component: WarehousesPage,
});

const empty: WarehouseInput = {
  name: "",
  sender_name: "",
  sender_phone: "",
  address: "",
  origin_subdistrict_id: "",
  origin_label: "",
  is_default: false,
  is_active: true,
};

function WarehousesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listWarehouses);
  const save = useServerFn(upsertWarehouse);
  const remove = useServerFn(deleteWarehouse);
  const searchDest = useServerFn(searchDestinations);

  const wq = useQuery({ queryKey: ["warehouses"], queryFn: () => list() });
  const [editing, setEditing] = useState<WarehouseInput | null>(null);
  const [originQ, setOriginQ] = useState("");
  const originResults = useQuery({
    queryKey: ["dest", "wh-origin", originQ],
    queryFn: () => searchDest({ data: { q: originQ, limit: 15 } }),
    enabled: originQ.trim().length >= 3,
  });

  const saveMut = useMutation({
    mutationFn: (p: WarehouseInput) => save({ data: p }),
    onSuccess: () => {
      toast.success("Gudang tersimpan");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Gudang dihapus");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <WarehouseIcon className="size-6" /> Gudang
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola lokasi asal pengiriman untuk perhitungan ongkir</p>
        </div>
        {!editing && (
          <Button onClick={() => setEditing({ ...empty })}><Plus className="size-4 mr-1" />Gudang baru</Button>
        )}
      </div>

      {editing && (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">{editing.id ? "Ubah gudang" : "Gudang baru"}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nama gudang<span className="text-destructive">*</span></Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="cth. Gudang Solo" />
            </div>
            <div>
              <Label>Nama pengirim (di label)</Label>
              <Input value={editing.sender_name ?? ""} onChange={(e) => setEditing({ ...editing, sender_name: e.target.value })} />
            </div>
            <div>
              <Label>Telepon pengirim</Label>
              <Input value={editing.sender_phone ?? ""} onChange={(e) => setEditing({ ...editing, sender_phone: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
                <Label className="cursor-pointer">Jadikan gudang default</Label>
              </div>
            </div>
          </div>
          <div>
            <Label>Alamat</Label>
            <Textarea rows={2} value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
          </div>
          <div>
            <Label>Lokasi asal (untuk ongkir)</Label>
            {editing.origin_subdistrict_id ? (
              <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{editing.origin_label}</div>
                  <div className="text-xs text-muted-foreground">ID: {editing.origin_subdistrict_id}</div>
                </div>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => setEditing({ ...editing, origin_subdistrict_id: "", origin_label: "" })}>
                  Ganti
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Input
                  placeholder="Cari kelurahan/kota asal (min. 3 huruf)…"
                  value={originQ}
                  onChange={(e) => setOriginQ(e.target.value)}
                  className="rounded-none border-0 border-b focus-visible:ring-0"
                />
                <div className="max-h-56 overflow-auto">
                  {(originResults.data ?? []).map((d: Destination) => (
                    <button
                      key={d.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onClick={() => {
                        setEditing({ ...editing, origin_subdistrict_id: d.id, origin_label: d.label });
                        setOriginQ("");
                      }}
                    >
                      <div className="font-medium">{d.subdistrict_name}, {d.district_name}</div>
                      <div className="text-xs text-muted-foreground">{d.city_name} · {d.zip_code}</div>
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
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            <Button onClick={() => saveMut.mutate(editing)} disabled={saveMut.isPending || !editing.name}>
              {saveMut.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Nama</th>
              <th className="text-left px-4 py-3">Lokasi asal</th>
              <th className="text-left px-4 py-3">Pengirim</th>
              <th className="text-right px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(wq.data ?? []).map((w: any) => (
              <tr key={w.id} className="border-t hover:bg-accent/40">
                <td className="px-4 py-3">
                  <div className="font-medium flex items-center gap-2">{w.name} {w.is_default && <Badge variant="secondary">Default</Badge>}</div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{w.origin_label || "—"}</td>
                <td className="px-4 py-3 text-xs">{w.sender_name || "—"} <span className="text-muted-foreground">· {w.sender_phone || "—"}</span></td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing({
                    id: w.id, name: w.name, sender_name: w.sender_name, sender_phone: w.sender_phone,
                    address: w.address, origin_subdistrict_id: w.origin_subdistrict_id, origin_label: w.origin_label,
                    is_default: w.is_default, is_active: w.is_active,
                  })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm(`Hapus gudang ${w.name}?`)) delMut.mutate(w.id);
                  }}>
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {wq.data?.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Belum ada gudang</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
