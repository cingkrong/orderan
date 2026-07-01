import { useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getProduct, upsertProduct } from "@/lib/products.functions";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage } from "@/components/storage-image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Trash2, Star, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";


type VariantForm = {
  id?: string;
  label: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  cost: number;
  weight_g: number;
  stock: number;
  is_default: boolean;
  image_url: string | null;
};

type ProductFormState = {
  id?: string;
  name: string;
  variants: VariantForm[];
};

const emptyVariant = (): VariantForm => ({
  label: "Default",
  sku: "",
  color: "",
  size: "",
  price: 0,
  cost: 0,
  weight_g: 0,
  stock: 0,
  is_default: true,
  image_url: null,
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
              color: v.color ?? "",
              size: v.size ?? "",
              price: Number(v.price),
              cost: Number(v.cost ?? 0),
              weight_g: v.weight_g,
              stock: v.stock,
              is_default: !!v.is_default,
              image_url: v.image_url ?? null,
            }))
          : [
              {
                label: loadQ.data.variant || "Default",
                sku: loadQ.data.sku ?? "",
                color: "",
                size: "",
                price: Number(loadQ.data.price),
                cost: Number((loadQ.data as any).cost ?? 0),
                weight_g: loadQ.data.weight_g,
                stock: loadQ.data.stock,
                is_default: true,
                image_url: null,
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
        color: v.color || null,
        size: v.size || null,
        image_url: v.image_url,
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
          color: "",
          size: "",
          price: f.variants[0]?.price ?? 0,
          cost: f.variants[0]?.cost ?? 0,
          weight_g: f.variants[0]?.weight_g ?? 0,
          stock: 0,
          is_default: false,
          image_url: null,
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
          {form.variants.map((v, idx) => (
            <VariantRow
              key={v.id ?? `new-${idx}`}
              variant={v}
              onChange={(patch) => updateVariant(idx, patch)}
              onSetDefault={() => setDefault(idx)}
              onRemove={() => removeVariant(idx)}
            />
          ))}
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

function VariantRow({
  variant,
  onChange,
  onSetDefault,
  onRemove,
}: {
  variant: VariantForm;
  onChange: (patch: Partial<VariantForm>) => void;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const margin = variant.price > 0 ? ((variant.price - variant.cost) / variant.price) * 100 : 0;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran gambar maks 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      // Remove old file if any
      if (variant.image_url) {
        await supabase.storage.from("product-images").remove([variant.image_url]);
      }
      onChange({ image_url: path });
      toast.success("Gambar diunggah");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal unggah");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (!variant.image_url) return;
    await supabase.storage.from("product-images").remove([variant.image_url]);
    onChange({ image_url: null });
  }

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant={variant.is_default ? "default" : "ghost"}
          onClick={onSetDefault}
          title="Jadikan default"
          className="h-8 w-8"
        >
          <Star className={`size-4 ${variant.is_default ? "fill-current" : ""}`} />
        </Button>
        <Input
          value={variant.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="cth. Merah / L"
          className="font-medium"
        />
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} className="h-8 w-8">
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative shrink-0">
          <div className="relative h-24 w-24 rounded-md overflow-hidden border bg-background">
            <StorageImage path={variant.image_url} alt={variant.label} className="h-full w-full object-cover" />
            {variant.image_url && !uploading && (
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-1 right-1 rounded-full bg-background/90 border p-0.5 hover:bg-background"
                title="Hapus gambar"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-24"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Upload className="size-3 mr-1" />}
            {variant.image_url ? "Ganti" : "Unggah"}
          </Button>
        </div>

        <div className="flex-1 grid sm:grid-cols-2 md:grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">SKU</Label>
            <Input value={variant.sku} onChange={(e) => onChange({ sku: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Warna</Label>
            <Input value={variant.color} onChange={(e) => onChange({ color: e.target.value })} placeholder="cth. Merah" />
          </div>
          <div>
            <Label className="text-xs">Ukuran</Label>
            <Input value={variant.size} onChange={(e) => onChange({ size: e.target.value })} placeholder="cth. L" />
          </div>

          <div>
            <Label className="text-xs">Harga jual (Rp)</Label>
            <Input type="number" value={variant.price} onChange={(e) => onChange({ price: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Modal / HPP (Rp)</Label>
            <Input type="number" value={variant.cost} onChange={(e) => onChange({ cost: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Berat (g)</Label>
            <Input type="number" value={variant.weight_g} onChange={(e) => onChange({ weight_g: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Stok</Label>
            <Input type="number" value={variant.stock} onChange={(e) => onChange({ stock: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      {variant.price > 0 && variant.cost > 0 && (
        <p className="text-xs text-muted-foreground">
          Margin {margin.toFixed(1)}% · Profit/unit Rp {(variant.price - variant.cost).toLocaleString("id-ID")}
        </p>
      )}
    </div>
  );
}

