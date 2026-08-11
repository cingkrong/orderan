import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { z } from "zod";
import { getOrdersByIds, markLabelPrinted } from "@/lib/orders.functions";
import { getSettings } from "@/lib/settings.functions";
import { ShippingLabel } from "@/components/shipping-label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Printer, FileText } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/labels")({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ ids: z.string().optional() }).parse(search),
  component: LabelsPage,
});

const LINCAH_COURIERS = ["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana", "tiki"];

function LabelsPage() {
  const search = Route.useSearch();
  const fetchOrders = useServerFn(getOrdersByIds);
  const fetchSettings = useServerFn(getSettings);
  const markPrinted = useServerFn(markLabelPrinted);
  const qc = useQueryClient();

  const [manualIds, setManualIds] = useState(search.ids ?? "");
  const [filterCourierType, setFilterCourierType] = useState<"all" | "lincah" | "custom">("all");
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

  const [paperSize, setPaperSize] = useState<"100x100" | "100x150">("100x150");

  useEffect(() => {
    if (settingsQ.data?.label_paper_size) {
      setPaperSize(settingsQ.data.label_paper_size === "100x100" ? "100x100" : "100x150");
    }
  }, [settingsQ.data]);

  const itemsByOrder = new Map<string, Array<{ name: string; variant: string | null; qty: number }>>();
  for (const it of ordersQ.data?.items ?? []) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push({ name: it.name, variant: it.variant, qty: it.qty });
    itemsByOrder.set(it.order_id, arr);
  }
  const s = settingsQ.data;
  const rawOrders = ordersQ.data?.orders ?? [];

  const orders = rawOrders.filter((o) => {
    const rawCourier = (o.courier || "").toLowerCase().replace("lincah:", "").trim();
    const isLincah = LINCAH_COURIERS.includes(rawCourier);
    if (filterCourierType === "lincah") return isLincah;
    if (filterCourierType === "custom") return !isLincah;
    return true;
  });

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
        // non-blocking
      }
    }
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Dynamic print style injection */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === "100x100" ? "100mm 100mm" : "100mm 150mm"};
            margin: 0;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .label-page {
            page-break-after: always;
            break-after: page;
            box-shadow: none !important;
            border: 1px solid black !important;
            margin: 0 auto !important;
          }
          .label-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Header controls */}
      <div className="no-print flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card p-4 rounded-lg border shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Label Pengiriman</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Format layout otomatis presisi · thermal printer
          </p>
          {orders.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Menampilkan {orders.length} label ({alreadyPrinted} sudah pernah dicetak)
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Courier Type Filter */}
          <div className="flex items-center bg-muted p-1 rounded-md border text-xs">
            <button
              type="button"
              onClick={() => setFilterCourierType("all")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                filterCourierType === "all" ? "bg-background text-foreground shadow-xs border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua ({rawOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterCourierType("lincah")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                filterCourierType === "lincah" ? "bg-background text-foreground shadow-xs border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Lincah.id
            </button>
            <button
              type="button"
              onClick={() => setFilterCourierType("custom")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                filterCourierType === "custom" ? "bg-background text-foreground shadow-xs border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Custom / Non-Lincah
            </button>
          </div>

          {/* Paper Size selector */}
          <div className="flex items-center bg-muted p-1 rounded-md border text-xs">
            <span className="text-[11px] text-muted-foreground font-semibold px-2 flex items-center gap-1">
              <FileText className="size-3.5" /> Ukuran:
            </span>
            <button
              type="button"
              onClick={() => setPaperSize("100x150")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                paperSize === "100x150"
                  ? "bg-background text-foreground shadow-xs border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              100×150mm
            </button>
            <button
              type="button"
              onClick={() => setPaperSize("100x100")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                paperSize === "100x100"
                  ? "bg-background text-foreground shadow-xs border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              100×100mm
            </button>
          </div>

          <Button onClick={handlePrint} disabled={!orders.length}>
            <Printer className="size-4 mr-1.5" /> Cetak {orders.length} Label
          </Button>
        </div>
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

      {/* Label Sheet Preview */}
      <div className="label-sheet flex flex-wrap gap-6 justify-center py-2">
        {orders.map((o) => {
          const count = (o as any).label_print_count ?? 0;
          const printedAt = (o as any).label_printed_at;
          return (
            <div key={o.id} className="relative">
              {count > 0 && (
                <Badge variant="secondary" className="no-print absolute -top-3 -right-3 z-10 shadow-xs">
                  Dicetak {count}× {printedAt && `· ${format(new Date(printedAt), "dd MMM HH:mm", { locale: idLocale })}`}
                </Badge>
              )}
              <ShippingLabel
                paperSize={paperSize}
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
                  shipping_cost: (o as any).shipping_cost,
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
