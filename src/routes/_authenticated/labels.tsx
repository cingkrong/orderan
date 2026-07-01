import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { getOrdersByIds, markLabelPrinted } from "@/lib/orders.functions";
import { getSettings } from "@/lib/settings.functions";
import { ShippingLabel } from "@/components/shipping-label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/labels")({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ ids: z.string().optional() }).parse(search),
  component: LabelsPage,
});

function LabelsPage() {
  const search = Route.useSearch();
  const fetchOrders = useServerFn(getOrdersByIds);
  const fetchSettings = useServerFn(getSettings);
  const markPrinted = useServerFn(markLabelPrinted);
  const qc = useQueryClient();

  const [manualIds, setManualIds] = useState(search.ids ?? "");
  const ids = (search.ids ?? manualIds)
    .split(/[\s,]+/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  const ordersQ = useQuery({
    queryKey: ["labels", ids],
    queryFn: () => fetchOrders({ data: { ids } }),
    enabled: ids.length > 0,
  });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });

  const itemsByOrder = new Map<string, Array<{ name: string; variant: string | null; qty: number }>>();
  for (const it of ordersQ.data?.items ?? []) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push({ name: it.name, variant: it.variant, qty: it.qty });
    itemsByOrder.set(it.order_id, arr);
  }
  const s = settingsQ.data;
  const orders = ordersQ.data?.orders ?? [];
  const alreadyPrinted = orders.filter((o) => ((o as any).label_print_count ?? 0) > 0).length;

  async function handlePrint() {
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length) {
      try {
        await markPrinted({ data: { ids: orderIds } });
        qc.invalidateQueries({ queryKey: ["orders"] });
        qc.invalidateQueries({ queryKey: ["shipping-orders"] });
        qc.invalidateQueries({ queryKey: ["order"] });
        qc.invalidateQueries({ queryKey: ["labels"] });
      } catch {
        // non-blocking — user tetap bisa cetak
      }
    }
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Label pengiriman</h1>
          <p className="text-muted-foreground text-sm mt-1">100 × 150 mm thermal · satu label per halaman</p>
          {orders.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {alreadyPrinted} dari {orders.length} label sudah pernah dicetak
            </p>
          )}
        </div>
        <Button onClick={handlePrint} disabled={!orders.length}>
          <Printer className="size-4 mr-1" /> Cetak {orders.length} label
        </Button>
      </div>


      {ids.length === 0 && (
        <Card className="no-print p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Tempel ID pesanan (dipisah koma atau spasi), atau pilih pesanan dari halaman Pesanan lalu klik "Cetak label".
          </p>
          <Textarea rows={4} value={manualIds} onChange={(e) => setManualIds(e.target.value)} placeholder="uuid, uuid, uuid…" />
        </Card>
      )}

      {!s && (
        <Card className="no-print p-5 text-sm text-warning-foreground bg-warning/20">
          Lengkapi info pengirim di Pengaturan sebelum mencetak.
        </Card>
      )}

      <div className="label-sheet flex flex-wrap gap-4 justify-center">
        {orders.map((o) => {
          const count = (o as any).label_print_count ?? 0;
          const printedAt = (o as any).label_printed_at;
          return (
            <div key={o.id} className="relative">
              {count > 0 && (
                <Badge variant="secondary" className="no-print absolute -top-2 -right-2 z-10">
                  Dicetak {count}× {printedAt && `· ${format(new Date(printedAt), "dd MMM HH:mm", { locale: idLocale })}`}
                </Badge>
              )}
              <ShippingLabel
                data={{
                  order_number: o.order_number ?? "",
                  customer_name: o.customer_name,
                  phone: o.phone,
                  full_address: o.full_address,
                  city: o.city,
                  postal_code: o.postal_code,
                  courier: o.courier,
                  service: o.service,
                  tracking_number: o.tracking_number,
                  weight_g: o.weight_g,
                  insurance: o.insurance,
                  routing_code: o.routing_code,
                  note: o.note,
                  items: itemsByOrder.get(o.id) ?? [],
                  is_dropship: (o as any).is_dropship ?? false,
                  dropship_name: (o as any).dropship_name,
                  dropship_phone: (o as any).dropship_phone,
                  sender: {
                    name: s?.sender_name ?? "",
                    phone: s?.sender_phone ?? "",
                    city: s?.sender_city ?? "",
                    address: s?.sender_address ?? "",
                    logo_url: s?.logo_url ?? null,
                  },
                }}
              />
            </div>
          );
        })}
      </div>

    </div>
  );
}
