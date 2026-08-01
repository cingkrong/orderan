import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listProducts, deleteProduct } from "@/lib/products.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { useWeightUnit } from "@/hooks/use-weight-unit";

export const Route = createFileRoute("/_authenticated/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const fetchAll = useServerFn(listProducts);
  const del = useServerFn(deleteProduct);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => fetchAll() });
  const { format: wFormat } = useWeightUnit();

  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Dihapus");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Produk</h1>
          <p className="text-muted-foreground text-sm mt-1">Katalog yang dipakai saat membuat pesanan</p>
        </div>
        <Button asChild>
          <Link to="/products/new">
            <Plus className="size-4 mr-1" /> Produk baru
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Produk</th>
                <th className="p-3 font-medium">Variasi</th>
                <th className="p-3 font-medium text-right">Rentang harga</th>
                <th className="p-3 font-medium text-right">Margin</th>
                <th className="p-3 font-medium text-right">Berat</th>
                <th className="p-3 font-medium text-right">Stok</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : (data ?? []).length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Belum ada produk</td></tr>
              ) : (
                data!.map((p: any) => {
                  const variants: any[] = p.variants ?? [];
                  const prices = variants.map((v) => Number(v.price));
                  const costs = variants.map((v) => Number(v.cost));
                  const minP = prices.length ? Math.min(...prices) : Number(p.price);
                  const maxP = prices.length ? Math.max(...prices) : Number(p.price);
                  const avgCost = costs.length ? costs.reduce((s, c) => s + c, 0) / costs.length : Number(p.cost ?? 0);
                  const avgPrice = prices.length ? prices.reduce((s, c) => s + c, 0) / prices.length : Number(p.price);
                  const margin = avgPrice > 0 ? ((avgPrice - avgCost) / avgPrice) * 100 : 0;
                  const totalStock = variants.length ? variants.reduce((s, v) => s + Number(v.stock ?? 0), 0) : p.stock;
                  const weights = variants.map((v) => Number(v.weight_g));
                  const weightLabel = weights.length && Math.min(...weights) !== Math.max(...weights)
                    ? `${wFormat(Math.min(...weights))}–${wFormat(Math.max(...weights))}`
                    : wFormat(weights[0] ?? p.weight_g);
                  const priceLabel = minP === maxP ? formatIDR(minP) : `${formatIDR(minP)}–${formatIDR(maxP)}`;
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-3">
                        <div className="font-medium">{p.name}</div>
                        {variants[0]?.sku && (
                          <div className="text-xs text-muted-foreground font-mono">{variants[0].sku}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-xs text-muted-foreground">
                          {variants.length === 0 ? "—" : variants.length === 1 ? variants[0].label : `${variants.length} variasi`}
                        </div>
                        {variants.length > 1 && (
                          <div className="text-xs text-muted-foreground">
                            {variants.slice(0, 3).map((v) => v.label).join(", ")}
                            {variants.length > 3 ? "…" : ""}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">{priceLabel}</td>
                      <td className={`p-3 text-right tabular-nums ${margin >= 0 ? "text-success" : "text-destructive"}`}>
                        {avgCost > 0 ? `${margin.toFixed(1)}%` : "—"}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{weightLabel}</td>
                      <td className="p-3 text-right tabular-nums">{totalStock}</td>
                      <td className="p-3 flex gap-1 justify-end">
                        <Button asChild size="icon" variant="ghost">
                          <Link to="/products/$id/edit" params={{ id: p.id }}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Hapus ${p.name}?`)) removeMut.mutate(p.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
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
