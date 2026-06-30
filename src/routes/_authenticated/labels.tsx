import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { getOrdersByIds } from "@/lib/orders.functions";
import { getSettings } from "@/lib/settings.functions";
import { ShippingLabel } from "@/components/shipping-label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/labels")({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ ids: z.string().optional() }).parse(search),
  component: LabelsPage,
});

function LabelsPage() {
  const search = Route.useSearch();
  const fetchOrders = useServerFn(getOrdersByIds);
  const fetchSettings = useServerFn(getSettings);

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

  return (
    <div className="space-y-6">
      <div className="no-print flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Shipping labels</h1>
          <p className="text-muted-foreground text-sm mt-1">100 × 150 mm thermal · prints one per page</p>
        </div>
        <Button onClick={() => window.print()} disabled={!ordersQ.data?.orders.length}>
          <Printer className="size-4 mr-1" /> Print {ordersQ.data?.orders.length ?? 0} label{(ordersQ.data?.orders.length ?? 0) === 1 ? "" : "s"}
        </Button>
      </div>

      {ids.length === 0 && (
        <Card className="no-print p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste order IDs (comma or space-separated), or select orders from the Orders page and click "Print labels".
          </p>
          <Textarea rows={4} value={manualIds} onChange={(e) => setManualIds(e.target.value)} placeholder="uuid, uuid, uuid…" />
        </Card>
      )}

      {!s && (
        <Card className="no-print p-5 text-sm text-warning-foreground bg-warning/20">
          Please fill sender info in Settings before printing.
        </Card>
      )}

      <div className="label-sheet flex flex-wrap gap-4 justify-center">
        {(ordersQ.data?.orders ?? []).map((o) => (
          <ShippingLabel
            key={o.id}
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
              sender: {
                name: s?.sender_name ?? "",
                phone: s?.sender_phone ?? "",
                city: s?.sender_city ?? "",
                address: s?.sender_address ?? "",
                logo_url: s?.logo_url ?? null,
              },
            }}
          />
        ))}
      </div>
    </div>
  );
}
