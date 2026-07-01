import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listProducts, deleteProduct } from "@/lib/products.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatIDR, formatWeight } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const fetchAll = useServerFn(listProducts);
  const del = useServerFn(deleteProduct);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => fetchAll() });

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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">Catalog used when creating orders</p>
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
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 font-medium text-right">Harga</th>
                <th className="p-3 font-medium text-right">Berat</th>
                <th className="p-3 font-medium text-right">Stok</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : (data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Belum ada produk</td></tr>
              ) : (
                data!.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      {p.variant && <div className="text-xs text-muted-foreground">{p.variant}</div>}
                    </td>
                    <td className="p-3 font-mono text-xs">{p.sku ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{formatIDR(p.price)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatWeight(p.weight_g)}</td>
                    <td className="p-3 text-right tabular-nums">{p.stock}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
