import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listOrderHistory, listStockMovements } from "@/lib/stock.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const ACTION_LABEL: Record<string, string> = {
  created: "Pesanan dibuat",
  status_changed: "Status berubah",
  payment_changed: "Status bayar",
  tracking_set: "Resi diisi",
  label_printed: "Label dicetak",
};

const REASON_LABEL: Record<string, string> = {
  "order:item_added": "Item ditambahkan ke pesanan",
  "order:item_removed": "Item dihapus dari pesanan",
  "order:item_changed": "Varian item diubah",
  "order:qty_changed": "Qty item diubah",
  "order:cancelled": "Pesanan dibatalkan (stok dikembalikan)",
  "order:uncancelled": "Pesanan diaktifkan kembali",
  manual: "Penyesuaian manual",
  "backfill:existing_order": "Backfill pesanan lama",
};

function fmt(d: string) {
  return format(new Date(d), "dd MMM yyyy HH:mm", { locale: idLocale });
}

export function OrderHistoryCard({ orderId }: { orderId: string }) {
  const fetchHistory = useServerFn(listOrderHistory);
  const fetchMovements = useServerFn(listStockMovements);
  const hist = useQuery({
    queryKey: ["order-history", orderId],
    queryFn: () => fetchHistory({ data: { order_id: orderId } }),
  });
  const moves = useQuery({
    queryKey: ["stock-movements", "order", orderId],
    queryFn: () => fetchMovements({ data: { order_id: orderId, limit: 100 } }),
  });

  const rows = [
    ...(hist.data ?? []).map((h: any) => ({
      when: h.created_at,
      kind: "history" as const,
      label: ACTION_LABEL[h.action] ?? h.action,
      detail:
        h.from_value || h.to_value
          ? `${h.from_value ?? "—"} → ${h.to_value ?? "—"}`
          : "",
      actor: h.actor?.full_name,
    })),
    ...(moves.data ?? []).map((m: any) => ({
      when: m.created_at,
      kind: "stock" as const,
      label: REASON_LABEL[m.reason] ?? m.reason,
      detail: `${m.delta > 0 ? "+" : ""}${m.delta} · ${m.note ?? ""} (${m.stock_before}→${m.stock_after})`,
      actor: undefined,
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));

  return (
    <Card className="p-5 space-y-3">
      <h2 className="font-semibold">Riwayat Pesanan</h2>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Belum ada aktivitas.</div>
      ) : (
        <ol className="space-y-2 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-2 border-l-2 pl-3 border-muted">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={r.kind === "stock" ? "secondary" : "outline"}>{r.label}</Badge>
                  {r.actor && <span className="text-xs text-muted-foreground">oleh {r.actor}</span>}
                </div>
                {r.detail && <div className="text-xs text-muted-foreground mt-0.5">{r.detail}</div>}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">{fmt(r.when)}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function StockHistoryCard({ productId }: { productId: string }) {
  const fetchMovements = useServerFn(listStockMovements);
  const q = useQuery({
    queryKey: ["stock-movements", "product", productId],
    queryFn: () => fetchMovements({ data: { product_id: productId, limit: 200 } }),
  });

  return (
    <Card className="p-5 space-y-3">
      <h2 className="font-semibold">Riwayat Stok</h2>
      {(q.data ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground">Belum ada pergerakan stok.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-1 pr-2">Waktu</th>
                <th className="py-1 pr-2">Varian</th>
                <th className="py-1 pr-2">Alasan</th>
                <th className="py-1 pr-2 text-right">Δ</th>
                <th className="py-1 pr-2 text-right">Stok</th>
                <th className="py-1 pr-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((m: any) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-1 pr-2 text-xs whitespace-nowrap">{fmt(m.created_at)}</td>
                  <td className="py-1 pr-2 text-xs">
                    {[m.variant?.color, m.variant?.size].filter(Boolean).join(" / ") ||
                      m.variant?.label ||
                      "—"}
                  </td>
                  <td className="py-1 pr-2 text-xs">{REASON_LABEL[m.reason] ?? m.reason}</td>
                  <td
                    className={`py-1 pr-2 text-right font-mono ${m.delta > 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}
                  </td>
                  <td className="py-1 pr-2 text-right text-xs text-muted-foreground">
                    {m.stock_before}→{m.stock_after}
                  </td>
                  <td className="py-1 pr-2 text-xs text-muted-foreground">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
