import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listProducts, upsertProduct, deleteProduct } from "@/lib/products.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatIDR, formatWeight } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
});

type ProductForm = {
  id?: string;
  name: string;
  sku: string;
  variant: string;
  price: number;
  weight_g: number;
  stock: number;
};
const empty: ProductForm = { name: "", sku: "", variant: "", price: 0, weight_g: 0, stock: 0 };

function ProductsPage() {
  const fetchAll = useServerFn(listProducts);
  const upsert = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => fetchAll() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(empty);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: form.id,
          name: form.name,
          sku: form.sku || null,
          variant: form.variant || null,
          price: Number(form.price) || 0,
          weight_g: Number(form.weight_g) || 0,
          stock: Number(form.stock) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Product saved");
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
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
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New product</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div><Label>Variant</Label><Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Price (Rp)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
                <div><Label>Weight (g)</Label><Input type="number" value={form.weight_g} onChange={(e) => setForm({ ...form, weight_g: Number(e.target.value) })} /></div>
                <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 font-medium text-right">Price</th>
                <th className="p-3 font-medium text-right">Weight</th>
                <th className="p-3 font-medium text-right">Stock</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : (data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No products yet</td></tr>
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
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setForm({
                            id: p.id,
                            name: p.name,
                            sku: p.sku ?? "",
                            variant: p.variant ?? "",
                            price: Number(p.price),
                            weight_g: p.weight_g,
                            stock: p.stock,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete ${p.name}?`)) removeMut.mutate(p.id);
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
