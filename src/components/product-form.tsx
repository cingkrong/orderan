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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Star, Upload, X, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

type VariantForm = {
  id?: string;
  label: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  cost: number;
  dropship_price: number;
  weight_g: number;
  stock: number;
  is_default: boolean;
  image_url: string | null;
};

type WholesaleTier = { min_qty: number; price: number };

type ProductFormState = {
  id?: string;
  name: string;
  description: string;
  category: string;
  product_type: "stock" | "preorder";
  wholesale_enabled: boolean;
  wholesale_tiers: WholesaleTier[];
  discount_type: string;
  discount_value: number;
  storefront_visible: boolean;
  show_stock: boolean;
  variants: VariantForm[];
};

const emptyVariant = (isFirst = true): VariantForm => ({
  label: isFirst ? "Default" : "",
  sku: "",
  color: "",
  size: "",
  price: 0,
  cost: 0,
  dropship_price: 0,
  weight_g: 0,
  stock: 0,
  is_default: isFirst,
  image_url: null,
});

const empty: ProductFormState = {
  name: "",
  description: "",
  category: "",
  product_type: "stock",
  wholesale_enabled: false,
  wholesale_tiers: [],
  discount_type: "",
  discount_value: 0,
  storefront_visible: false,
  show_stock: false,
  variants: [emptyVariant()],
};

const CATEGORIES = [
  "Fashion",
  "Aksesoris",
  "Kecantikan",
  "Makanan & Minuman",
  "Elektronik",
  "Rumah Tangga",
  "Lainnya",
];

function slugPart(s: string, len = 4) {
  return (s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, len);
}

function generateSku(name: string, color: string, size: string, idx: number) {
  const base = slugPart(name, 5) || "PRD";
  const parts = [base];
  const c = slugPart(color, 3);
  const sz = slugPart(size, 3);
  if (c) parts.push(c);
  if (sz) parts.push(sz);
  parts.push(String(idx + 1).padStart(2, "0"));
  return parts.join("-");
}

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 md:gap-6 py-6 border-b last:border-b-0">
      <div>
        <h3 className="font-semibold text-primary">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function ProductForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getProduct);
  const upsert = useServerFn(upsertProduct);

  const [form, setForm] = useState<ProductFormState>(empty);
  const [createAnother, setCreateAnother] = useState(false);

  const loadQ = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchOne({ data: { id: id! } }),
    enabled: !!id,
  });

  useEffect(() => {
    if (!loadQ.data) return;
    const d: any = loadQ.data;
    const variants: VariantForm[] =
      (d.variants ?? []).length > 0
        ? d.variants.map((v: any) => ({
            id: v.id,
            label: v.label,
            sku: v.sku ?? "",
            color: v.color ?? "",
            size: v.size ?? "",
            price: Number(v.price),
            cost: Number(v.cost ?? 0),
            dropship_price: Number(v.dropship_price ?? 0),
            weight_g: v.weight_g,
            stock: v.stock,
            is_default: !!v.is_default,
            image_url: v.image_url ?? null,
          }))
        : [emptyVariant()];
    if (!variants.some((v) => v.is_default)) variants[0].is_default = true;
    setForm({
      id: d.id,
      name: d.name ?? "",
      description: d.description ?? "",
      category: d.category ?? "",
      product_type: d.product_type ?? "stock",
      wholesale_enabled: !!d.wholesale_enabled,
      wholesale_tiers: Array.isArray(d.wholesale_tiers) ? d.wholesale_tiers : [],
      discount_type: d.discount_type ?? "",
      discount_value: Number(d.discount_value ?? 0),
      storefront_visible: !!d.storefront_visible,
      show_stock: !!d.show_stock,
      variants,
    });
  }, [loadQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const variants = form.variants.map((v, idx) => ({
        id: v.id,
        label: v.label.trim() || `Variasi ${idx + 1}`,
        sku: (v.sku && v.sku.trim()) || generateSku(form.name, v.color, v.size, idx),
        color: v.color || null,
        size: v.size || null,
        image_url: v.image_url,
        price: Number(v.price) || 0,
        cost: Number(v.cost) || 0,
        dropship_price: Number(v.dropship_price) || 0,
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
          description: form.description || null,
          category: form.category || null,
          product_type: form.product_type,
          sku: def.sku,
          variant: variants.length > 1 ? `${variants.length} variasi` : def.label,
          price: def.price,
          cost: def.cost,
          weight_g: def.weight_g,
          stock: variants.reduce((s, v) => s + v.stock, 0),
          wholesale_enabled: form.wholesale_enabled,
          wholesale_tiers: form.wholesale_tiers,
          discount_type: form.discount_type || null,
          discount_value: form.discount_type ? Number(form.discount_value) || 0 : null,
          storefront_visible: form.storefront_visible,
          show_stock: form.show_stock,
          variants,
        },
      });
    },
    onSuccess: () => {
      toast.success("Produk disimpan");
      qc.invalidateQueries({ queryKey: ["products"] });
      if (createAnother && !id) {
        setForm(empty);
        setCreateAnother(false);
      } else {
        navigate({ to: "/products" });
      }
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
      variants: [...f.variants, emptyVariant(false)],
    }));
  }

  function duplicateVariant(idx: number) {
    setForm((f) => {
      const src = f.variants[idx];
      const copy: VariantForm = { ...src, id: undefined, is_default: false, sku: "" };
      const next = [...f.variants];
      next.splice(idx + 1, 0, copy);
      return { ...f, variants: next };
    });
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

  function addTier() {
    setForm((f) => ({
      ...f,
      wholesale_tiers: [...f.wholesale_tiers, { min_qty: 1, price: 0 }],
    }));
  }

  function updateTier(idx: number, patch: Partial<WholesaleTier>) {
    setForm((f) => ({
      ...f,
      wholesale_tiers: f.wholesale_tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  }

  function removeTier(idx: number) {
    setForm((f) => ({
      ...f,
      wholesale_tiers: f.wholesale_tiers.filter((_, i) => i !== idx),
    }));
  }

  if (id && loadQ.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="max-w-5xl mx-auto pb-24">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
          {id ? "Ubah Produk" : "Buat Produk"}
        </h1>
      </div>

      <Card className="p-0 divide-y">
        {/* GENERAL */}
        <div className="px-5">
          <FormSection title="General" hint="Informasi umum produk">
            <div>
              <Label>
                Judul produk<span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="cth. Kaos Polos Premium"
              />
            </div>
            <div>
              <Label>
                Deskripsi<span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={8}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Deskripsikan produk Anda…"
              />
            </div>
            <div>
              <Label>
                Kategori<span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormSection>
        </div>

        {/* INVENTORI */}
        <div className="px-5">
          <FormSection title="Inventori" hint="Atur stok produk">
            <div className="flex items-center gap-6">
              <Label className="text-muted-foreground">Jenis Produk</Label>
              <RadioGroup
                value={form.product_type}
                onValueChange={(v) =>
                  setForm({ ...form, product_type: v as "stock" | "preorder" })
                }
                className="flex gap-6"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="stock" id="pt-stock" />
                  <span className="text-sm">Produk stok sendiri</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="preorder" id="pt-preorder" />
                  <span className="text-sm">Produk Pre-Order</span>
                </label>
              </RadioGroup>
            </div>
          </FormSection>
        </div>

        {/* VARIAN */}
        <div className="px-5">
          <FormSection title="Varian Produk" hint="Atur varian produk">
            <div className="space-y-3">
              {form.variants.map((v, idx) => (
                <VariantRow
                  key={v.id ?? `new-${idx}`}
                  variant={v}
                  index={idx}
                  productName={form.name}
                  onChange={(patch) => updateVariant(idx, patch)}
                  onSetDefault={() => setDefault(idx)}
                  onDuplicate={() => duplicateVariant(idx)}
                  onRemove={() => removeVariant(idx)}
                />
              ))}
              <Button variant="outline" size="sm" onClick={addVariant}>
                <Plus className="size-4 mr-1" /> Tambah Varian
              </Button>
            </div>
          </FormSection>
        </div>

        {/* HARGA GROSIR */}
        <div className="px-5">
          <FormSection
            title="Harga Grosir"
            hint="Atur harga grosir pada produk, misal: jumlah pembelian 1 - 10 harga Rp15.000, 11 - 20 harga Rp12.000"
          >
            <div>
              <Label className="text-muted-foreground">Rentang Harga Grosir</Label>
              <div className="mt-2 space-y-2">
                {form.wholesale_tiers.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12">Min qty</span>
                    <Input
                      type="number"
                      className="w-24"
                      value={t.min_qty}
                      onChange={(e) => updateTier(idx, { min_qty: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">Harga</span>
                    <Input
                      type="number"
                      className="w-40"
                      value={t.price}
                      onChange={(e) => updateTier(idx, { price: Number(e.target.value) })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTier(idx)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTier}>
                  Tambah Harga
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Switch
                  checked={form.wholesale_enabled}
                  onCheckedChange={(v) => setForm({ ...form, wholesale_enabled: v })}
                />
                <span className="text-sm">Aktifkan Grosir</span>
              </div>
            </div>
          </FormSection>
        </div>

        {/* PROMOSI */}
        <div className="px-5">
          <FormSection title="Promosi" hint="Atur harga spesial untuk produk ini">
            <div>
              <Label className="text-muted-foreground">Jenis diskon</Label>
              <Select
                value={form.discount_type || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, discount_type: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih salah satu opsi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa diskon</SelectItem>
                  <SelectItem value="percent">Persentase (%)</SelectItem>
                  <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
              {form.discount_type && (
                <div className="mt-2">
                  <Label className="text-xs">
                    Nilai diskon ({form.discount_type === "percent" ? "%" : "Rp"})
                  </Label>
                  <Input
                    type="number"
                    value={form.discount_value}
                    onChange={(e) =>
                      setForm({ ...form, discount_value: Number(e.target.value) })
                    }
                    className="w-40"
                  />
                </div>
              )}
            </div>
          </FormSection>
        </div>

        {/* STOREFRONT */}
        <div className="px-5">
          <FormSection title="Storefront">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Switch
                  checked={form.storefront_visible}
                  onCheckedChange={(v) => setForm({ ...form, storefront_visible: v })}
                />
                <div>
                  <div className="text-sm font-medium">Tampilkan</div>
                  <p className="text-xs text-muted-foreground">
                    Produk akan muncul di Storefront
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Switch
                  checked={form.show_stock}
                  onCheckedChange={(v) => setForm({ ...form, show_stock: v })}
                />
                <div>
                  <div className="text-sm font-medium">Tampilkan jumlah stok</div>
                  <p className="text-xs text-muted-foreground">
                    Jika aktif, jumlah stok akan ditampilkan. Jika tidak aktif ditampilkan
                    "Stok tersedia" atau "Stok habis"
                  </p>
                </div>
              </div>
            </div>
          </FormSection>
        </div>
      </Card>

      {/* STICKY FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-20">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-2">
          <Button
            onClick={() => {
              setCreateAnother(false);
              save.mutate();
            }}
            disabled={!form.name || save.isPending}
          >
            {save.isPending && !createAnother ? "Menyimpan…" : id ? "Simpan" : "Buat"}
          </Button>
          {!id && (
            <Button
              variant="outline"
              onClick={() => {
                setCreateAnother(true);
                save.mutate();
              }}
              disabled={!form.name || save.isPending}
            >
              Buat & buat lainnya
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link to="/products">Batal</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function VariantRow({
  variant,
  index,
  productName,
  onChange,
  onSetDefault,
  onDuplicate,
  onRemove,
}: {
  variant: VariantForm;
  index: number;
  productName: string;
  onChange: (patch: Partial<VariantForm>) => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
    <div className="rounded-md border p-3 bg-muted/20">
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-3">
        {/* IMAGE */}
        <div>
          <Label className="text-xs">Foto</Label>
          <div
            className="mt-1 relative h-28 rounded-md border border-dashed bg-background flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => !uploading && fileRef.current?.click()}
          >
            {variant.image_url ? (
              <>
                <StorageImage
                  path={variant.image_url}
                  alt={variant.label}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage();
                  }}
                  className="absolute top-1 right-1 rounded-full bg-background/90 border p-0.5 hover:bg-background"
                >
                  <X className="size-3" />
                </button>
              </>
            ) : uploading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-center text-xs text-muted-foreground px-2">
                <Upload className="size-4 mx-auto mb-1" />
                Seret & Jatuhkan berkas atau{" "}
                <span className="text-primary underline">Jelajahi</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {/* FIELDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">Warna</Label>
            <Input
              value={variant.color}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="cth. Merah"
            />
          </div>
          <div>
            <Label className="text-xs">Ukuran</Label>
            <Input
              value={variant.size}
              onChange={(e) => onChange({ size: e.target.value })}
              placeholder="cth. XL"
            />
          </div>
          <div>
            <Label className="text-xs">
              Berat<span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={variant.weight_g}
                onChange={(e) => onChange({ weight_g: Number(e.target.value) })}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Gram
              </span>
            </div>
          </div>
          <div>
            <Label className="text-xs">
              SKU<span className="text-destructive">*</span>
            </Label>
            <Input
              value={variant.sku}
              placeholder={generateSku(productName, variant.color, variant.size, index)}
              onChange={(e) => onChange({ sku: e.target.value })}
              onBlur={() => {
                if (!variant.sku.trim()) {
                  onChange({ sku: generateSku(productName, variant.color, variant.size, index) });
                }
              }}
            />
          </div>
          <div>
            <Label className="text-xs">
              Harga Beli (HPP)<span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                className="pl-8"
                value={variant.cost}
                onChange={(e) => onChange({ cost: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">
              Harga Normal<span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                className="pl-8"
                value={variant.price}
                onChange={(e) => onChange({ price: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Harga Dropshipper</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                className="pl-8"
                value={variant.dropship_price}
                onChange={(e) => onChange({ dropship_price: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Stok</Label>
            <Input
              type="number"
              value={variant.stock}
              onChange={(e) => onChange({ stock: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex md:flex-col items-center gap-1">
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
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onDuplicate}
            title="Duplikat"
            className="h-8 w-8"
          >
            <Copy className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onRemove}
            title="Hapus"
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
