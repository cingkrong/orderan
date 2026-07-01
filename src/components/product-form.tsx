import { useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getProduct, upsertProduct } from "@/lib/products.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type ProductFormState = {
  id?: string;
  name: string;
  sku: string;
  variant: string;
  price: number;
  cost: number;
  weight_g: number;
  stock: number;
};
const empty: ProductFormState = { name: "", sku: "", variant: "", price: 0, cost: 0, weight_g: 0, stock: 0 };

export function ProductForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getProduct);
  const upsert = useServerFn(upsertProduct);

  const [form, setForm] = useState<ProductFormState>(empty);

  const loadQ = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchOne({ data: { id: id! } }),
    enabled: !!id,
  });

  useEffect(() => {
    if (loadQ.data) {
      setForm({
        id: loadQ.data.id,
        name: loadQ.data.name,
        sku: loadQ.data.sku ?? "",
        variant: loadQ.data.variant ?? "",
        price: Number(loadQ.data.price),
        cost: Number((loadQ.data as any).cost ?? 0),
        weight_g: loadQ.data.weight_g,
        stock: loadQ.data.stock,
      });
    }
  }, [loadQ.data]);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: form.id,
          name: form.name,
          sku: form.sku || null,
          variant: form.variant || null,
          price: Number(form.price) || 0,
          cost: Number(form.cost) || 0,
          weight_g: Number(form.weight_g) || 0,
          stock: Number(form.stock) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Produk disimpan");
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/products" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  if (id && loadQ.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/products"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {id ? "Ubah produk" : "Produk baru"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {id ? "Perbarui detail produk" : "Tambah produk ke katalog Anda"}
          </p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <Label>Nama</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <Label>Varian</Label>
            <Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Harga jual (Rp)</Label>
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Harga modal / HPP (Rp)</Label>
            <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
            {form.price > 0 && form.cost > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Margin: {(((form.price - form.cost) / form.price) * 100).toFixed(1)}% · Profit/unit Rp {(form.price - form.cost).toLocaleString("id-ID")}
              </p>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Berat (g)</Label>
            <Input type="number" value={form.weight_g} onChange={(e) => setForm({ ...form, weight_g: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Stok</Label>
            <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to="/products">Batal</Link>
        </Button>
        <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
          {save.isPending ? "Menyimpan…" : "Simpan produk"}
        </Button>
      </div>
    </div>
  );
}
