import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOrders, setTracking } from "@/lib/orders.functions";
import { createLincahOrder, trackLincahOrder, printLincahLabel } from "@/lib/lincah.functions";
import { getShippingCost, searchDestinations } from "@/lib/shipping.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { COURIERS, COURIER_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { Printer, Truck, Search, Send, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shipping")({
  component: ShippingPage,
});

function ShippingPage() {
  const fetchOrders = useServerFn(listOrders);
  const setTrack = useServerFn(setTracking);
  const bookLincah = useServerFn(createLincahOrder);
  const trackLincah = useServerFn(trackLincahOrder);
  const printLincah = useServerFn(printLincahLabel);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [courier, setCourier] = useState<string>("all");
  const [pending, setPending] = useState<Record<string, string>>({});
  const [bookingId, setBookingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shipping-orders", courier],
    queryFn: () =>
      fetchOrders({
        data: { search: "", status: null, source: null, courier: courier === "all" ? null : courier, limit: 100 },
      }),
  });

  const mut = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      setTrack({ data: { id, tracking_number: value, markShipped: true } }),
    onSuccess: () => {
      toast.success("Resi tersimpan");
      qc.invalidateQueries({ queryKey: ["shipping-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  async function handleBookLincah(order: any) {
    setBookingId(order.id);
    try {
      const courierCode = (order.courier || "jne").replace("lincah:", "").toLowerCase();
      const courierService = order.service || "REG";
      const isCod = order.payment_status === "cod" || order.payment_status === "unpaid";
      const destCode = order.destination_subdistrict_id || "1101010001";

      const res = await bookLincah({
        data: {
          order_id: order.id,
          courier: courierCode,
          courier_service: courierService,
          is_cod: isCod,
          cod_price: isCod ? Number(order.total) : 0,
          product_price: !isCod ? Number(order.total) : 0,
          weight_kg: Math.max(0.1, Number(order.weight_g || 1000) / 1000),
          quantity: 1,
          product_name: `Pesanan #${order.order_number}`,
          recipient_name: order.customer_name || order.recipient_name || "Pelanggan",
          recipient_phone: order.phone || order.recipient_phone || "081234567890",
          recipient_address: order.full_address || order.city || "Alamat tujuan",
          destination_code: destCode,
          note: order.note || "-",
        },
      });

      toast.success(`Booking Lincah.id Berhasil! Resi: ${res.resi}`);
      qc.invalidateQueries({ queryKey: ["shipping-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      toast.error(`Booking Lincah.id Gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBookingId(null);
    }
  }

  async function handleTrackResi(resi: string) {
    try {
      const res = await trackLincah({ data: { resiOrOrderId: resi } });
      const statusText = res.data && res.data.length ? res.data[0].status || "Sedang diproses" : "Resi terdaftar";
      toast.info(`Status Lacak (${resi}): ${statusText}`);
    } catch (err) {
      toast.error(`Gagal melacak resi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handlePrintLincahLabel(order: any) {
    try {
      const res = await printLincah(order.tracking_number);
      if (res && res.awb) {
        window.open(res.awb, "_blank");
      } else {
        navigate({ to: "/labels", search: { ids: order.id } as any });
      }
    } catch {
      navigate({ to: "/labels", search: { ids: order.id } as any });
    }
  }

  const queue = (data ?? []).filter((o) => !["completed", "cancelled"].includes(o.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pengiriman & Booking Resi</h1>
        <p className="text-muted-foreground text-sm mt-1">Kelola nomor resi, lacak pengiriman, dan booking penjemputan Lincah.id</p>
      </div>

      <Card className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={courier} onValueChange={setCourier}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Kurir" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kurir</SelectItem>
              {COURIERS.map((c) => <SelectItem key={c} value={c}>{COURIER_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{queue.length} pengiriman aktif</span>
        </div>

        <div className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <Truck className="size-4" />
          <span>Terhubung dengan <strong>Lincah.id API (Cek Ongkir & Booking Resi Instant)</strong></span>
        </div>
      </Card>

      {/* Calculator Cek Ongkir Lincah.id */}
      <CekOngkirLincahCard />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Pesanan</th>
                <th className="p-3 font-medium">Pelanggan & Tujuan</th>
                <th className="p-3 font-medium">Kurir</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">No. Resi</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : queue.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Semua pengiriman selesai 🎉</td></tr>
              ) : (
                queue.map((o) => {
                  const hasResi = Boolean(o.tracking_number);
                  const isBooking = bookingId === o.id;

                  return (
                    <tr key={o.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <Link to="/orders/$id" params={{ id: o.id }} className="font-mono text-xs font-semibold text-primary hover:underline">
                          #{o.order_number}
                        </Link>
                        {((o as any).label_print_count ?? 0) > 0 && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              Label ✓ {(o as any).label_print_count}×
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{o.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{o.city || o.full_address}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-xs">
                          {o.courier ? `${COURIER_LABEL[o.courier.replace("lincah:", "")] ?? o.courier}` : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">{o.service ?? ""}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className={STATUS_TONE[o.status]}>
                          {STATUS_LABEL[o.status]}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <Input
                            placeholder="Ketik/Paste Resi"
                            value={pending[o.id] ?? o.tracking_number ?? ""}
                            onChange={(e) => setPending((p) => ({ ...p, [o.id]: e.target.value }))}
                            className="h-8 text-xs font-mono"
                          />
                          {hasResi && (
                            <button
                              type="button"
                              onClick={() => handleTrackResi(o.tracking_number!)}
                              className="text-[11px] text-primary hover:underline flex items-center gap-1"
                            >
                              <Search className="size-3" /> Lacak status resi
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1.5 justify-end flex-wrap">
                          {!hasResi && (
                            <Button
                              size="sm"
                              variant="default"
                              disabled={isBooking}
                              onClick={() => handleBookLincah(o)}
                              className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {isBooking ? (
                                <RefreshCw className="size-3.5 animate-spin" />
                              ) : (
                                <Send className="size-3.5" />
                              )}
                              {isBooking ? "Booking..." : "Booking Lincah"}
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => navigate({ to: "/labels", search: { ids: o.id } as any })}
                          >
                            <Printer className="size-3.5 mr-1" />
                            Label
                          </Button>

                          {pending[o.id] && pending[o.id] !== o.tracking_number && (
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              disabled={mut.isPending}
                              onClick={() => mut.mutate({ id: o.id, value: pending[o.id] })}
                            >
                              Simpan
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CekOngkirLincahCard() {
  const getRates = useServerFn(getShippingCost);
  const searchDest = useServerFn(searchDestinations);

  const [destQ, setDestQ] = useState("");
  const [selectedDest, setSelectedDest] = useState<{ id: string; label: string } | null>(null);
  const [weightG, setWeightG] = useState(1000);
  const [isCod, setIsCod] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const destResults = useQuery({
    queryKey: ["cek-ongkir-dest", destQ],
    queryFn: () => searchDest({ data: { q: destQ, limit: 10 } }),
    enabled: destQ.trim().length >= 3 && !selectedDest,
  });

  async function handleCheckOngkir(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDest) {
      toast.error("Pilih kecamatan/kota tujuan terlebih dahulu");
      return;
    }
    setCalculating(true);
    try {
      const res = await getRates({
        data: {
          destination_subdistrict_id: selectedDest.id,
          weight_g: Number(weightG),
          is_cod: isCod,
          force_refresh: true,
        },
      });
      setResults(res || []);
      if ((res || []).length === 0) {
        toast.warning("Tidak ada opsi ongkir yang ditemukan dari Lincah.id API.");
      } else {
        toast.success(`Ditemukan ${res.length} opsi pengiriman Lincah.id!`);
      }
    } catch (err) {
      toast.error(`Cek ongkir gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCalculating(false);
    }
  }

  return (
    <Card className="p-5 space-y-4 border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
          <Truck className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold text-base">Cek Ongkir Lincah.id API (Diskon & COD Real-Time)</h2>
          <p className="text-xs text-muted-foreground">
            Perhitungkan biaya kirim resmi, diskon spesial Lincah.id, dan estimasi waktu sampai dari berbagai ekspedisi.
          </p>
        </div>
      </div>

      <form onSubmit={handleCheckOngkir} className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="text-xs font-semibold block mb-1">Tujuan (Kecamatan / Kota)</label>
          {selectedDest ? (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-1.5 text-xs">
              <span className="font-medium truncate">{selectedDest.label}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[11px]"
                onClick={() => {
                  setSelectedDest(null);
                  setDestQ("");
                }}
              >
                Ganti
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Ketik minimal 3 huruf..."
                value={destQ}
                onChange={(e) => setDestQ(e.target.value)}
                className="h-9 text-xs"
              />
              {destQ.trim().length >= 3 && destResults.data && destResults.data.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md">
                  {destResults.data.map((d: any) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelectedDest({ id: d.id, label: d.label });
                        setDestQ("");
                      }}
                      className="w-full text-left p-2 text-xs hover:bg-accent rounded"
                    >
                      <div className="font-medium">{d.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Berat Paket (gram)</label>
          <Input
            type="number"
            min={1}
            value={weightG}
            onChange={(e) => setWeightG(Number(e.target.value))}
            className="h-9 text-xs font-mono"
            placeholder="1000"
          />
        </div>

        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 border bg-card p-2 rounded-md h-9 cursor-pointer text-xs font-medium">
            <input
              type="checkbox"
              checked={isCod}
              onChange={(e) => setIsCod(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            Metode COD
          </label>

          <Button
            type="submit"
            disabled={calculating}
            className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
          >
            {calculating ? (
              <>
                <RefreshCw className="size-3.5 mr-1.5 animate-spin" /> Menghitung...
              </>
            ) : (
              "Hitung Ongkir Lincah"
            )}
          </Button>
        </div>
      </form>

      {/* Results view */}
      {results.length > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-500/20">
          <h3 className="text-xs font-semibold mb-2 text-emerald-700 dark:text-emerald-300">
            Hasil Opsi Pengiriman Lincah.id ({results.length} opsi):
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {results.map((r: any, idx: number) => {
              const hasDiscount = r.discount_percent && r.discount_percent > 0;
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg border bg-card shadow-xs space-y-1.5 hover:border-emerald-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs uppercase text-emerald-700 dark:text-emerald-400">
                      {r.courier_name || r.courier_code} ({r.service})
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                      {r.etd ? `ETD: ${r.etd} hari` : "Reguler"}
                    </Badge>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-foreground">
                      Rp {Number(r.value || 0).toLocaleString("id-ID")}
                    </span>
                    {hasDiscount && r.original_value && (
                      <span className="text-xs line-through text-muted-foreground">
                        Rp {Number(r.original_value).toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>

                  {hasDiscount && (
                    <div className="text-[11px] font-medium text-emerald-600">
                      Diskon Lincah: {r.discount_percent}% OFF
                    </div>
                  )}

                  {r.special_terms && (
                    <div className="text-[10px] text-muted-foreground truncate" title={r.special_terms}>
                      {r.special_terms}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
