import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getOrder, updateOrderStatus, setTracking, markLabelPrinted } from "@/lib/orders.functions";
import { getSettings } from "@/lib/settings.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShippingLabel } from "@/components/shipping-label";
import { formatIDR, STATUS_LABEL, STATUS_TONE, COURIER_LABEL } from "@/lib/format";
import { Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatIDR, STATUS_LABEL, STATUS_TONE, COURIER_LABEL } from "@/lib/format";
import { Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderDetail,
});

const STATUSES = ["pending", "confirmed", "processing", "shipped", "completed", "cancelled"] as const;

function OrderDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOrder = useServerFn(getOrder);
  const updateStatus = useServerFn(updateOrderStatus);
  const setTrack = useServerFn(setTracking);
  const fetchSettings = useServerFn(getSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder({ data: { id } }),
  });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });

  const [tracking, setTrackingState] = useState("");

  const statusMut = useMutation({
    mutationFn: (status: string) => updateStatus({ data: { ids: [id], status: status as any } }),
    onSuccess: () => {
      toast.success("Status diperbarui");
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const trackMut = useMutation({
    mutationFn: () => setTrack({ data: { id, tracking_number: tracking, markShipped: true } }),
    onSuccess: () => {
      toast.success("Resi tersimpan & ditandai Dikirim");
      setTrackingState("");
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const { order, items } = data;
  const s = settingsQ.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono">{order.order_number}</h1>
            <Badge variant="secondary" className={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Dibuat {format(new Date(order.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-1" /> Cetak label</Button>
          <Button variant="outline" asChild>
            <Link to="/orders/$id/edit" params={{ id }}><Pencil className="size-4 mr-1" /> Ubah</Link>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 no-print">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div>
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              Customer & address
              {(order as any).is_dropship && <Badge variant="outline">Dropship</Badge>}
            </h2>
            <div className="text-sm space-y-1">
              <div className="font-medium">{order.customer_name} <span className="text-muted-foreground">· {order.phone}</span></div>
              <div>{order.full_address}</div>
              <div className="text-muted-foreground">
                {[order.district, order.city, order.province, order.postal_code].filter(Boolean).join(", ")}
              </div>
              {(order as any).is_dropship && (
                <div className="mt-2 pt-2 border-t text-xs">
                  <div className="font-semibold uppercase text-muted-foreground">Pengirim (Dropship)</div>
                  <div>{(order as any).dropship_name || "—"} · {(order as any).dropship_phone || "—"}</div>
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="font-semibold mb-2">Items</h2>
            <table className="w-full text-sm">
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="py-2">
                      <div className="font-medium">{it.name}</div>
                      {it.variant && <div className="text-xs text-muted-foreground">{it.variant}</div>}
                    </td>
                    <td className="py-2 text-center w-16">{it.qty}×</td>
                    <td className="py-2 text-right tabular-nums">{formatIDR(Number(it.price) * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t mt-2 pt-2 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatIDR(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ongkir {order.service ? `(${order.service})` : ""}</span><span className="tabular-nums">{formatIDR(order.shipping_cost)}</span></div>
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="tabular-nums">{formatIDR(order.total)}</span></div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold">Status</h2>
            <Select value={order.status} onValueChange={(v) => statusMut.mutate(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Sumber: {order.source ?? "—"}{order.campaign ? ` · ${order.campaign}` : ""}{order.ref ? ` · ref: ${order.ref}` : ""}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold">Shipping</h2>
            <div className="text-sm space-y-1">
              <div>{order.courier ? COURIER_LABEL[order.courier] ?? order.courier : "—"} {order.service}</div>
              {order.eta && <div className="text-muted-foreground text-xs">Estimasi: {order.eta} hari</div>}
              {order.tracking_number ? (
                <div className="font-mono text-xs bg-muted p-2 rounded">{order.tracking_number}</div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Masukkan no. resi"
                    value={tracking}
                    onChange={(e) => setTrackingState(e.target.value)}
                  />
                  <Button size="sm" onClick={() => trackMut.mutate()} disabled={!tracking || trackMut.isPending} className="w-full">
                    Simpan resi & tandai dikirim
                  </Button>
                </div>
              )}
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/labels", search: { ids: id } as any })}>
              <Printer className="size-4 mr-1" /> Buka halaman label
            </Button>
          </Card>
        </div>
      </div>

      {/* Print-only label */}
      {s && (
        <div className="hidden print:block">
          <div className="label-sheet flex flex-wrap gap-2 justify-center">
            <ShippingLabel
              data={{
                order_number: order.order_number ?? "",
                customer_name: order.customer_name,
                phone: order.phone,
                full_address: order.full_address,
                city: order.city,
                postal_code: order.postal_code,
                courier: order.courier,
                service: order.service,
                tracking_number: order.tracking_number,
                weight_g: order.weight_g,
                insurance: order.insurance,
                routing_code: order.routing_code,
                note: order.note,
                items: items.map((i) => ({ name: i.name, variant: i.variant, qty: i.qty })),
                is_dropship: (order as any).is_dropship ?? false,
                dropship_name: (order as any).dropship_name,
                dropship_phone: (order as any).dropship_phone,
                sender: {
                  name: s.sender_name,
                  phone: s.sender_phone,
                  city: s.sender_city,
                  address: s.sender_address,
                  logo_url: s.logo_url,
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
