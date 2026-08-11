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
import { COURIERS, COURIER_LABEL, STATUS_LABEL, STATUS_TONE, formatCourierName } from "@/lib/format";
import { Printer, Truck, Search, Send, ExternalLink, RefreshCw, Calculator } from "lucide-react";
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
          product_name: `Pesanan ${order.order_number.startsWith('#') ? order.order_number : `#${order.order_number}`}`,
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

        <div className="flex items-center justify-between gap-3 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <Truck className="size-4 shrink-0" />
            <span>Terhubung dengan <strong>Lincah.id API (Booking Resi Instant & Auto Shipping)</strong></span>
          </div>
          <Button size="sm" asChild className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0">
            <Link to="/cek-ongkir">
              <Calculator className="size-3.5" /> Buka Kalkulator Cek Ongkir
            </Link>
          </Button>
        </div>
      </Card>

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
                          {(o.order_number || "").startsWith('#') ? o.order_number : `#${o.order_number ?? ""}`}
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
                          {formatCourierName(o.courier, o.service)}
                        </div>
                        <div className="text-xs text-muted-foreground">{o.courier !== "custom" ? (o.service ?? "") : ""}</div>
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

