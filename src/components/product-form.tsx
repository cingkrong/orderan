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
import { ArrowLeft, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

type VariantForm = {
  id?: string;
  label: string;
  sku: string;
  price: number;
  cost: number;
  weight_g: number;
  stock: number;
  is_default: boolean;
};

type ProductFormState = {
  id?: string;
  name: string;
  variants: VariantForm[];
};

const emptyVariant = (): VariantForm => ({
  label: "Default",
  sku: "",
  price: 0,
  cost: 0,
  weight_g: 0,
  stock: 0,
  is_default: true,
});

const empty: ProductFormState = { name: "", variants: [emptyVariant()] };

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
      const variants: VariantForm[] =
        ((loadQ.data as any).variants ?? []).length > 0
          ? (loadQ.data as any).variants.map((v: any) => ({
              id: v.id,
              label: v.label,
              sku: v.sku ?? "",
              price: Number(v.price),
              cost: Number(v.cost ?? 0),
              weight_g: v.weight_g,
              stock: v.stock,
              is_default: !!v.is_default,
            }))
          : [
              {
                label: loadQ.data.variant || "Default",
                sku: loadQ.data.sku ?? "",
                price: Number(loadQ.data.price),
                cost: Number((loadQ.data as any).cost ?? 0),
                weight_g: loadQ.data.weight_g,
                stock: loadQ.data.stock,
                is_default: true,
              },
            ];
      if (!variants.some((v) => v.is_default)) variants[0].is_default = true;
      setForm({ id: loadQ.data.id, name: loadQ.data.name, variants });
    }
  }, [loadQ.data]);

  const save = useMutation({
    mutationFn: () => {
      const variants = form.variants.map((v, idx) => ({
        id: v.id,
        label: v.label.trim() || `Variasi ${idx + 1}`,
        sku: v.sku || null,
        price: Number(v.price) || 0,
        cost: Number(v.cost) || 0,
        weight_g: Number(v.weight_g) || 0,
        stock: Number(v.stock) || 0,
        is_default: v.is_default,
        sort_order: idx,
      }));
      const def = variants.find((v) => v.is_default) ?? variants[0];
      return upsert({
        data: {
          id: form.id,
          name: form.name,
          sku: def.sku,
          variant: variants.length > 1 ? `${variants.length} variasi` : def.label,
          price: def.price,
          cost: def.cost,
          weight_g: def.weight_g,
          stock: variants.reduce((s, v) => s + v.stock, 0),
          variants,
        },
      });
    },
    onSuccess: () => {
      toast.success("Produk disimpan");
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/products" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  function updateVariant(idx: number, patch: Partial<VariantForm>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }));
  }

  function setDefault(idx: number) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => ({ ...v, is_default: i === idx })),
    }));
  }

  function addVariant() {
    setForm((f) => ({
      ...f,
      variants: [
        ...f.variants,
        {
          label: `Variasi ${f.variants.length + 1}`,
          sku: "",
          price: f.variants[0]?.price ?? 0,
          cost: f.variants[0]?.cost ?? 0,
          weight_g: f.variants[0]?.weight_g ?? 0,
          stock: 0,
          is_default: false,
        },
      ],
    }));
  }

  function removeVariant(idx: number) {
    setForm((f) => {
      if (f.variants.length <= 1) {
        toast.error("Minimal 1 variasi");
        return f;
      }
      const next = f.variants.filter((_, i) => i !== idx);
      if (!next.some((v) => v.is_default)) next[0].is_default = true;
      return { ...f, variants: next };
    });
  }

  if (id && loadQ.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-4xl">
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
          <Label>Nama produk</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="cth. Kaos Polos Premium" />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Variasi</h2>
            <p className="text-xs text-muted-foreground">
              Setiap variasi punya SKU, harga, HPP, berat, dan stok sendiri. Klik bintang untuk memilih variasi default.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addVariant}>
            <Plus className="size-4 mr-1" /> Tambah variasi
          </Button>
        </div>

        <div className="space-y-3">
          {form.variants.map((v, idx) => {
            const margin = v.price > 0 ? ((v.price - v.cost) / v.price) * 100 : 0;
            return (
              <div key={idx} className="rounded-md border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant={v.is_default ? "default" : "ghost"}
                    onClick={() => setDefault(idx)}
                    title="Jadikan default"
                    className="h-8 w-8"
                  >
                    <Star className={`size-4 ${v.is_default ? "fill-current" : ""}`} />
                  </Button>
                  <Input
                    value={v.label}
                    onChange={(e) => updateVariant(idx, { label: e.target.value })}
                    placeholder="cth. Merah / L"
                    className="font-medium"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeVariant(idx)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-2">
                  <div>
                    <Label className="text-xs">SKU</Label>
                    <Input value={v.sku} onChange={(e) => updateVariant(idx, { sku: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Harga jual (Rp)</Label>
                    <Input type="number" value={v.price} onChange={(e) => updateVariant(idx, { price: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Modal / HPP (Rp)</Label>
                    <Input type="number" value={v.cost} onChange={(e) => updateVariant(idx, { cost: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Berat (g)</Label>
                    <Input type="number" value={v.weight_g} onChange={(e) => updateVariant(idx, { weight_g: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Stok</Label>
                    <Input type="number" value={v.stock} onChange={(e) => updateVariant(idx, { stock: Number(e.target.value) })} />
                  </div>
                </div>
                {v.price > 0 && v.cost > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Margin {margin.toFixed(1)}% · Profit/unit Rp {(v.price - v.cost).toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            );
          })}
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
