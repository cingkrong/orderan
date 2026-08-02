import { useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getProduct, upsertProduct } from "@/lib/products.functions";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage, useSignedImage } from "@/components/storage-image";
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
import { Plus, Trash2, Star, Upload, X, Loader2, Copy, Video, Film, Package } from "lucide-react";
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

type MediaItem = {
  path: string;
  type: "image" | "video";
};

function parseMediaList(raw?: string | null): MediaItem[] {
  if (!raw) return [];
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  const isVid = Boolean(raw.match(/\.(mp4|webm|mov|avi)$/i));
  return [{ path: raw, type: isVid ? "video" : "image" }];
}

function serializeMediaList(items: MediaItem[]): string | null {
  if (items.length === 0) return null;
  if (items.length === 1 && items[0].type === "image") return items[0].path;
  return JSON.stringify(items);
}

type ProductFormState = {
  id?: string;
  name: string;
  description: string;
  category: string;
  product_type: "stock" | "preorder";
  variant_enabled: boolean;
  discount_enabled: boolean;
  wholesale_enabled: boolean;
  wholesale_tiers: WholesaleTier[];
  discount_type: "percent" | "fixed";
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
  weight_g: 100, // Default 100 gram
  stock: 0,
  is_default: isFirst,
  image_url: null,
});

const empty: ProductFormState = {
  name: "",
  description: "",
  category: "Fashion",
  product_type: "stock",
  variant_enabled: false,
  discount_enabled: false,
  wholesale_enabled: false,
  wholesale_tiers: [],
  discount_type: "percent",
  discount_value: 0,
  storefront_visible: true,
  show_stock: true,
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
    if (!loadQ.data) return;
    const d: any = loadQ.data;
    const rawVariants: VariantForm[] =
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
            weight_g: Number(v.weight_g ?? 100),
            stock: Number(v.stock ?? 0),
            is_default: !!v.is_default,
            image_url: v.image_url ?? null,
          }))
        : [emptyVariant()];
    if (!rawVariants.some((v) => v.is_default)) rawVariants[0].is_default = true;

    const hasMultipleVariants =
      rawVariants.length > 1 || Boolean(rawVariants[0]?.color || rawVariants[0]?.size);

    setForm({
      id: d.id,
      name: d.name ?? "",
      description: d.description ?? "",
      category: d.category ?? "Fashion",
      product_type: d.product_type ?? "stock",
      variant_enabled: hasMultipleVariants,
      discount_enabled: Boolean(d.discount_type && Number(d.discount_value) > 0),
      wholesale_enabled: !!d.wholesale_enabled,
      wholesale_tiers: Array.isArray(d.wholesale_tiers) ? d.wholesale_tiers : [],
      discount_type: d.discount_type === "fixed" ? "fixed" : "percent",
      discount_value: Number(d.discount_value ?? 0),
      storefront_visible: !!d.storefront_visible,
      show_stock: !!d.show_stock,
      variants: rawVariants,
    });
  }, [loadQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const activeVariants = form.variant_enabled
        ? form.variants
        : [form.variants[0] || emptyVariant()];

      const variantsPayload = activeVariants.map((v, idx) => {
        const colorLabel = v.color ? `Warna: ${v.color}` : "";
        const sizeLabel = v.size ? `Ukuran: ${v.size}` : "";
        const autoLabel = [colorLabel, sizeLabel].filter(Boolean).join(" - ") || `Variasi ${idx + 1}`;

        return {
          id: v.id,
          label: v.label.trim() || autoLabel,
          sku: (v.sku && v.sku.trim()) || generateSku(form.name, v.color, v.size, idx),
          color: v.color || null,
          size: v.size || null,
          image_url: v.image_url,
          price: Number(v.price) || 0,
          cost: Number(v.cost) || 0,
          dropship_price: Number(v.dropship_price) || 0,
          weight_g: Number(v.weight_g) || 100, // Stored strictly in grams
          stock: Number(v.stock) || 0,
          is_default: v.is_default,
          sort_order: idx,
        };
      });

      const def = variantsPayload.find((v) => v.is_default) ?? variantsPayload[0];

      return upsert({
        data: {
          id: form.id,
          name: form.name,
          description: form.description || null,
          category: form.category || null,
          product_type: form.product_type,
          sku: def.sku,
          variant: variantsPayload.length > 1 ? `${variantsPayload.length} variasi` : def.label,
          price: def.price,
          cost: def.cost,
          weight_g: def.weight_g,
          stock: variantsPayload.reduce((s, v) => s + v.stock, 0),
          wholesale_enabled: form.wholesale_enabled,
          wholesale_tiers: form.wholesale_enabled ? form.wholesale_tiers : [],
          discount_type: form.discount_enabled ? form.discount_type : null,
          discount_value: form.discount_enabled ? Number(form.discount_value) || 0 : null,
          storefront_visible: form.storefront_visible,
          show_stock: form.show_stock,
          variants: variantsPayload,
        },
      });
    },
    onSuccess: () => {
      toast.success("Produk berhasil disimpan");
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/products" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan produk"),
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
      wholesale_tiers: [...f.wholesale_tiers, { min_qty: 2, price: 0 }],
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

  const primaryVariant = form.variants[0] || emptyVariant();

  return (
    <div className="space-y-6 pb-20">
      {/* BREADCRUMB HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{id ? "Ubah Produk" : "Form Tambah Produk"}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Home / Produk / {id ? "Form Ubah Produk" : "Form Tambah Produk"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* LEFT COLUMN: MAIN FORM */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
              <div>
                <Label className="text-xs font-semibold">
                  Nama Produk<span className="text-destructive">*</span>
                </Label>
                <Input
                  className="mt-1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="cth. Jilbab Madaniah"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Jenis Produk</Label>
                <Select
                  value={form.product_type}
                  onValueChange={(v) =>
                    setForm({ ...form, product_type: v as "stock" | "preorder" })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih Jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Barang Stock Sendiri</SelectItem>
                    <SelectItem value="preorder">Barang Pre-Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Keterangan Produk</Label>
              <Textarea
                rows={4}
                className="mt-1 text-xs"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Berbahan Diamond..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">
                  Berat (Satuan Gram)<span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="pr-16"
                    value={primaryVariant.weight_g}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setForm((f) => ({
                        ...f,
                        variants: f.variants.map((v) => ({ ...v, weight_g: val })),
                      }));
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                    gram
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Diukur penuh dalam gram (cth: 130 gram = 0.13 kg pada API ongkir).
                </p>
              </div>

              {form.discount_enabled && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Diskon Produk</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={form.discount_type === "percent" ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setForm({ ...form, discount_type: "percent" })}
                      >
                        % Persen
                      </Button>
                      <Button
                        type="button"
                        variant={form.discount_type === "fixed" ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setForm({ ...form, discount_type: "fixed" })}
                      >
                        Rp Potongan
                      </Button>
                    </div>
                  </div>

                  <div className="relative mt-1">
                    <Input
                      type="number"
                      min={0}
                      className="pr-12"
                      value={form.discount_value}
                      onChange={(e) =>
                        setForm({ ...form, discount_value: Number(e.target.value) || 0 })
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      {form.discount_type === "percent" ? "%" : "Rp"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* MULTI-MEDIA GALLERY UPLOADER (WHEN VARIAN IS OFF) */}
          {!form.variant_enabled && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="font-bold text-base">Galeri Foto & Video Produk (Opsional)</h2>
                  <p className="text-xs text-muted-foreground">
                    Unggah beberapa foto atau video produk. Jika kosong, thumbnail default akan digunakan secara otomatis.
                  </p>
                </div>
              </div>

              <MainGalleryUploader
                rawImageUrl={primaryVariant.image_url}
                onChange={(newRawUrl) => updateVariant(0, { image_url: newRawUrl })}
              />
            </Card>
          )}

          {/* SINGLE / MULTI VARIANT TABLE */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-base">
                {form.variant_enabled ? "Daftar Varian Produk (Warna & Ukuran)" : "Harga & Stok Produk"}
              </h2>
              {form.variant_enabled && (
                <Button variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="size-4 mr-1" /> Tambah Varian
                </Button>
              )}
            </div>

            {form.variant_enabled ? (
              <div className="space-y-4">
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
              </div>
            ) : (
              /* SINGLE VARIANT FORM FIELDS */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs font-semibold">SKU Produk</Label>
                  <Input
                    className="mt-1 font-mono text-xs"
                    value={primaryVariant.sku}
                    placeholder={generateSku(form.name, "", "", 0)}
                    onChange={(e) => updateVariant(0, { sku: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Harga Beli (HPP)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      type="number"
                      className="pl-8"
                      value={primaryVariant.cost}
                      onChange={(e) => updateVariant(0, { cost: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Harga Normal / Retail</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      type="number"
                      className="pl-8 font-semibold"
                      value={primaryVariant.price}
                      onChange={(e) => updateVariant(0, { price: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Harga Dropshipper</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      type="number"
                      className="pl-8"
                      value={primaryVariant.dropship_price}
                      onChange={(e) => updateVariant(0, { dropship_price: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Jumlah Stok</Label>
                  <Input
                    type="number"
                    min={0}
                    className="mt-1 font-semibold"
                    value={primaryVariant.stock}
                    onChange={(e) => updateVariant(0, { stock: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* HARGA GROSIR CARD (WHEN TOGGLED ON) */}
          {form.wholesale_enabled && (
            <Card className="p-5 space-y-4 border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="font-bold text-base">Setting Harga Grosir (Grosir Tier)</h2>
                <Button variant="outline" size="sm" onClick={addTier}>
                  <Plus className="size-4 mr-1" /> Tambah Tier Grosir
                </Button>
              </div>

              <div className="space-y-3">
                {form.wholesale_tiers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada rentang grosir. Klik "Tambah Tier Grosir" untuk mengatur harga khusus grosir berdasarkan minimal pembelian.
                  </p>
                ) : (
                  form.wholesale_tiers.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg border">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] font-semibold">Minimal Pembelian (Qty)</Label>
                          <Input
                            type="number"
                            min={1}
                            className="mt-1 text-xs font-semibold"
                            value={t.min_qty}
                            onChange={(e) => updateTier(idx, { min_qty: Number(e.target.value) || 1 })}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] font-semibold">Harga Satuan Grosir (Rp)</Label>
                          <Input
                            type="number"
                            min={0}
                            className="mt-1 text-xs font-semibold text-emerald-600"
                            value={t.price}
                            onChange={(e) => updateTier(idx, { price: Number(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTier(idx)}
                        className="text-destructive self-end mb-1"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: PRODUCT SETTING SIDEBAR */}
        <div className="space-y-4">
          <Card className="p-5 space-y-5 border-t-4 border-t-primary">
            <div>
              <h2 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                PRODUCT SETTING
              </h2>
            </div>

            <div className="space-y-4 divide-y divide-border">
              {/* TOGGLE VARIAN */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-sm font-semibold">Varian</div>
                  <p className="text-[11px] text-muted-foreground">Warna & Ukuran Size</p>
                </div>
                <Switch
                  checked={form.variant_enabled}
                  onCheckedChange={(v) => setForm({ ...form, variant_enabled: v })}
                />
              </div>

              {/* TOGGLE DISKON */}
              <div className="flex items-center justify-between pt-4">
                <div>
                  <div className="text-sm font-semibold">Diskon</div>
                  <p className="text-[11px] text-muted-foreground">Persentase (%) / Rp</p>
                </div>
                <Switch
                  checked={form.discount_enabled}
                  onCheckedChange={(v) => setForm({ ...form, discount_enabled: v })}
                />
              </div>

              {/* TOGGLE HARGA GROSIR */}
              <div className="flex items-center justify-between pt-4">
                <div>
                  <div className="text-sm font-semibold">Harga Grosir</div>
                  <p className="text-[11px] text-muted-foreground">Min Order Qty</p>
                </div>
                <Switch
                  checked={form.wholesale_enabled}
                  onCheckedChange={(v) => setForm({ ...form, wholesale_enabled: v })}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6 text-base shadow-sm"
                onClick={() => save.mutate()}
                disabled={!form.name || save.isPending}
              >
                {save.isPending ? "Menyimpan..." : "Simpan Produk"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

{/* COMPONENT: MULTI-MEDIA GALLERY UPLOADER */}
function MainGalleryUploader({
  rawImageUrl,
  onChange,
}: {
  rawImageUrl?: string | null;
  onChange: (val: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const mediaList = parseMediaList(rawImageUrl);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const newItems: MediaItem[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith("video/") || Boolean(file.name.match(/\.(mp4|webm|mov|avi)$/i));
        const maxMb = isVideo ? 50 : 10;

        if (file.size > maxMb * 1024 * 1024) {
          toast.error(`Ukuran ${file.name} melebihi ${maxMb} MB`);
          continue;
        }

        const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
        const path = `${crypto.randomUUID()}.${ext}`;

        const { error } = await supabase.storage.from("product-images").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

        if (error) throw error;
        newItems.push({ path, type: isVideo ? "video" : "image" });
      }

      const updated = [...mediaList, ...newItems];
      onChange(serializeMediaList(updated));
      toast.success(`${newItems.length} berkas media diunggah`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah berkas");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMedia(idx: number) {
    const next = mediaList.filter((_, i) => i !== idx);
    onChange(serializeMediaList(next));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {mediaList.map((item, idx) => (
          <MediaItemCard key={item.path} item={item} onRemove={() => removeMedia(idx)} />
        ))}

        {/* UPLOAD TRIGGER CARD */}
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="h-28 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors p-2 text-center"
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-primary" />
          ) : (
            <>
              <Upload className="size-5 text-primary mb-1" />
              <span className="text-[11px] font-semibold text-primary">Upload Foto/Video</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">JPG, PNG, MP4</span>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  );
}

function MediaItemCard({ item, onRemove }: { item: MediaItem; onRemove: () => void }) {
  const { url, isVideo } = useSignedImage(item.path);

  return (
    <div className="relative h-28 rounded-lg border overflow-hidden bg-background group">
      {isVideo ? (
        <div className="h-full w-full bg-black relative flex items-center justify-center">
          {url ? (
            <video src={url} className="h-full w-full object-cover" muted />
          ) : (
            <Film className="size-6 text-white/60 animate-pulse" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Video className="size-6 text-white" />
          </div>
        </div>
      ) : (
        <StorageImage path={item.path} className="h-full w-full object-cover" />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 rounded-full bg-background/90 text-destructive border shadow-sm hover:bg-background"
        title="Hapus"
      >
        <X className="size-3" />
      </button>
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran gambar maks 10 MB");
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
      toast.success("Foto varian diunggah");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal unggah foto");
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
    <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-4 items-start">
        {/* IMAGE */}
        <div>
          <Label className="text-xs font-semibold">Foto Varian (Opsional)</Label>
          <div
            className="mt-1 relative h-24 rounded-md border border-dashed bg-background flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
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
                  className="absolute top-1 right-1 rounded-full bg-background/90 border p-0.5 hover:bg-background text-destructive"
                >
                  <X className="size-3" />
                </button>
              </>
            ) : uploading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-center text-[10px] text-muted-foreground p-1 flex flex-col items-center">
                <Package className="size-5 text-muted-foreground/40 mb-1" />
                <span className="text-[10px] text-primary">Upload Foto</span>
                <span className="text-[9px] text-muted-foreground/60">atau Thumbnail Default</span>
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

        {/* FIELDS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-semibold">Warna</Label>
            <Input
              className="mt-1 text-xs"
              value={variant.color}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="cth. Merah / Hitam"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Ukuran (Size)</Label>
            <Input
              className="mt-1 text-xs"
              value={variant.size}
              onChange={(e) => onChange({ size: e.target.value })}
              placeholder="cth. S / M / L / XL"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">SKU Varian</Label>
            <Input
              className="mt-1 font-mono text-xs"
              value={variant.sku}
              placeholder={generateSku(productName, variant.color, variant.size, index)}
              onChange={(e) => onChange({ sku: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Harga Beli (HPP)</Label>
            <div className="relative mt-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                className="pl-7 text-xs"
                value={variant.cost}
                onChange={(e) => onChange({ cost: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Harga Normal / Retail</Label>
            <div className="relative mt-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                className="pl-7 text-xs font-semibold"
                value={variant.price}
                onChange={(e) => onChange({ price: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Harga Dropshipper</Label>
            <div className="relative mt-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                className="pl-7 text-xs"
                value={variant.dropship_price}
                onChange={(e) => onChange({ dropship_price: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Berat (Gram)</Label>
            <div className="relative mt-1">
              <Input
                type="number"
                min={0}
                className="pr-12 text-xs"
                value={variant.weight_g}
                onChange={(e) => onChange({ weight_g: Number(e.target.value) || 0 })}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
                gram
              </span>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Stok Varian</Label>
            <Input
              type="number"
              min={0}
              className="mt-1 text-xs font-bold"
              value={variant.stock}
              onChange={(e) => onChange({ stock: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex md:flex-col items-center gap-1 self-center">
          <Button
            type="button"
            size="icon"
            variant={variant.is_default ? "default" : "ghost"}
            onClick={onSetDefault}
            title="Jadikan Varian Utama"
            className="h-8 w-8"
          >
            <Star className={`size-4 ${variant.is_default ? "fill-current" : ""}`} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onDuplicate}
            title="Duplikat Varian"
            className="h-8 w-8"
          >
            <Copy className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onRemove}
            title="Hapus Varian"
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
