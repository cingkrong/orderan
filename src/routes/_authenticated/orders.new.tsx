import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { saveOrder, getOrder, type OrderInput } from "@/lib/orders.functions";
import { listProducts, quickCreateProduct } from "@/lib/products.functions";
import { getCustomerByPhone, searchCustomersByName } from "@/lib/customers.functions";
import { searchDestinations, getShippingCost, LINCAH_DISCOUNT_TABLE, type Destination } from "@/lib/shipping.functions";
import { listWarehouses } from "@/lib/warehouses.functions";
import { getSettings, updateSettings } from "@/lib/settings.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Truck, Loader2, ScanBarcode, Pencil, Info } from "lucide-react";

import { toast } from "sonner";
import { formatIDR, SOURCES, COURIERS, COURIER_LABEL } from "@/lib/format";

export const NewRoute = createFileRoute("/_authenticated/orders/new")({
  component: () => <OrderForm />,
});

const emptyForm: OrderInput = {
  customer_name: "",
  phone: "",
  full_address: "",
  province: "",
  city: "",
  district: "",
  postal_code: "",
  destination_city_id: "",
  destination_subdistrict_id: "",
  destination_label: "",
  courier: "jne",
  service: "",
  tracking_number: "",
  status: "pending",
  payment_status: "unpaid",
  source: "WA",
  campaign: "",
  ref: "",
  shipping_cost: 0,
  discount: 0,
  marketplace_fee: 0,
  eta: "",
  insurance: false,
  routing_code: "",
  note: "",
  is_dropship: false,
  dropship_name: "",
  dropship_phone: "",
  warehouse_id: null,
  recipient_name: "",
  recipient_phone: "",
  items: [],
};

function OrderForm({ existingId }: { existingId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveOrder);
  const fetchProducts = useServerFn(listProducts);
  const fetchCustomer = useServerFn(getCustomerByPhone);
  const fetchCities = useServerFn(searchDestinations);
  const fetchCost = useServerFn(getShippingCost);
  const fetchOrder = useServerFn(getOrder);
  const fetchWarehouses = useServerFn(listWarehouses);
  const fetchSettings = useServerFn(getSettings);
  const saveSettings = useServerFn(updateSettings);

  const productsQ = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const warehousesQ = useQuery({ queryKey: ["warehouses"], queryFn: () => fetchWarehouses() });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });
  const existingQ = useQuery({
    queryKey: ["order", existingId],
    queryFn: () => fetchOrder({ data: { id: existingId! } }),
    enabled: !!existingId,
  });

  const [form, setForm] = useState<OrderInput>(emptyForm);
  const [sameRecipient, setSameRecipient] = useState(true);
  const quickCreate = useServerFn(quickCreateProduct);
  const { unit: weightUnit, toDisplay: wDisplay, toGrams: wGrams } = useWeightUnit();

  // Per-item flags for "Item custom → Simpan ke katalog"
  type SaveCatalogEntry = { enabled: boolean; useColor: boolean; useSize: boolean; color: string; size: string };
  const [saveCatalog, setSaveCatalog] = useState<Record<number, SaveCatalogEntry>>({});
  const getSaveEntry = (idx: number): SaveCatalogEntry =>
    saveCatalog[idx] ?? { enabled: false, useColor: false, useSize: false, color: "", size: "" };
  const patchSaveEntry = (idx: number, patch: Partial<SaveCatalogEntry>) =>
    setSaveCatalog((s) => ({ ...s, [idx]: { ...getSaveEntry(idx), ...patch } }));


  // Set default warehouse on load
  useEffect(() => {
    if (!existingId && warehousesQ.data && !form.warehouse_id) {
      const def = warehousesQ.data.find((w: any) => w.is_default) ?? warehousesQ.data[0];
      if (def) setForm((f) => ({ ...f, warehouse_id: def.id }));
    }
  }, [warehousesQ.data, existingId, form.warehouse_id]);

  useEffect(() => {
    if (existingQ.data) {
      const { order, items } = existingQ.data as any;
      setForm({
        id: order.id,
        customer_name: order.customer_name,
        phone: order.phone,
        full_address: order.full_address,
        province: order.province ?? "",
        city: order.city ?? "",
        district: order.district ?? "",
        postal_code: order.postal_code ?? "",
        destination_city_id: order.destination_city_id ?? "",
        destination_subdistrict_id: order.destination_subdistrict_id ?? "",
        destination_label: order.destination_label ?? "",
        courier: order.courier ?? "jne",
        service: order.service ?? "",
        tracking_number: order.tracking_number ?? "",
        status: order.status,
        payment_status: order.payment_status ?? "unpaid",
        source: order.source ?? "",
        campaign: order.campaign ?? "",
        ref: order.ref ?? "",
        shipping_cost: Number(order.shipping_cost ?? 0),
        discount: Number(order.discount ?? 0),
        marketplace_fee: Number(order.marketplace_fee ?? 0),
        eta: order.eta ?? "",
        insurance: order.insurance,
        routing_code: order.routing_code ?? "",
        note: order.note ?? "",
        is_dropship: order.is_dropship ?? false,
        dropship_name: order.dropship_name ?? "",
        dropship_phone: order.dropship_phone ?? "",
        warehouse_id: order.warehouse_id ?? null,
        recipient_name: order.recipient_name ?? "",
        recipient_phone: order.recipient_phone ?? "",
        items: items.map((i: any) => ({
          product_id: i.product_id,
          variant_id: i.variant_id ?? null,
          name: i.name,
          variant: i.variant,
          qty: i.qty,
          price: Number(i.price),
          cost: Number(i.cost ?? 0),
          weight_g: i.weight_g,
        })),
      });
      setSameRecipient(!order.recipient_name);
    }
  }, [existingQ.data]);

  const subtotal = useMemo(() => form.items.reduce((s, i) => s + i.price * i.qty, 0), [form.items]);
  const totalCogs = useMemo(() => form.items.reduce((s, i) => s + (i.cost || 0) * i.qty, 0), [form.items]);
  const weight = useMemo(() => form.items.reduce((s, i) => s + i.weight_g * i.qty, 0), [form.items]);
  const discount = Number(form.discount) || 0;
  const marketplaceFee = Number(form.marketplace_fee) || 0;
  const shippingCost = Number(form.shipping_cost) || 0;
  const total = subtotal - discount + shippingCost;
  const estProfit = subtotal - discount - totalCogs - marketplaceFee;

  const fetchCustomerByName = useServerFn(searchCustomersByName);

  // Customer & Recipient Name Live Search
  const [customerSearchQ, setCustomerSearchQ] = useState("");
  const [recipientSearchQ, setRecipientSearchQ] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  const customerSearchQuery = useQuery({
    queryKey: ["customers-search-name", customerSearchQ],
    queryFn: () => fetchCustomerByName({ data: { query: customerSearchQ } }),
    enabled: customerSearchQ.trim().length >= 1 && showCustomerDropdown,
    staleTime: 10_000,
  });

  const recipientSearchQuery = useQuery({
    queryKey: ["customers-search-recipient", recipientSearchQ],
    queryFn: () => fetchCustomerByName({ data: { query: recipientSearchQ } }),
    enabled: recipientSearchQ.trim().length >= 1 && showRecipientDropdown,
    staleTime: 10_000,
  });

  async function tryAutofill(phone: string) {
    if (phone.length < 6) return;
    try {
      const c = await fetchCustomer({ data: { phone } });
      if (c) {
        const addr = (c.last_address as any) || {};
        setForm((f) => ({
          ...f,
          customer_name: c.name || f.customer_name,
          full_address: addr.full_address || f.full_address,
          city: addr.city || f.city,
          province: addr.province || f.province,
          district: addr.district || f.district,
          postal_code: addr.postal_code || f.postal_code,
          destination_subdistrict_id: addr.destination_subdistrict_id || f.destination_subdistrict_id,
          destination_label: addr.destination_label || f.destination_label,
          shipping_cost: 0,
          courier: "",
          service: "",
        }));
        toast.info(`Data ${c.name} dimuat`);
      }
    } catch {}
  }

  // City typeahead
  const [cityQ, setCityQ] = useState("");
  const citiesQuery = useQuery({
    queryKey: ["cities", cityQ],
    queryFn: () => fetchCities({ data: { q: cityQ } }),
    staleTime: 60_000,
  });

  // Shipping cost
  const [services, setServices] = useState<Array<{ service: string; description: string; value: number; original_value?: number; discount_percent?: number; special_terms?: string; cod_fee_percent?: number; etd: string; courier_code?: string; courier_name?: string; custom?: boolean }>>([]);
  const [loadingCost, setLoadingCost] = useState(false);
  const [costCached, setCostCached] = useState(false);

  // Custom courier inline form
  const [showCustomCourier, setShowCustomCourier] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState<number | "">("");
  const [savePreset, setSavePreset] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);

  function applyCustomCourier() {
    const name = customName.trim();
    const price = Number(customPrice);
    if (!name) return toast.error("Nama ekspedisi wajib diisi");
    if (!Number.isFinite(price) || price < 0) return toast.error("Ongkir tidak valid");

    setForm((f) => ({
      ...f,
      courier: "custom",
      service: name,
      shipping_cost: price,
      eta: "-",
    }));
    toast.success(`Jasa kirim custom "${name}" dipilih (${formatIDR(price)})`);

    if (savePreset) {
      void (async () => {
        setSavingPreset(true);
        try {
          const s = await fetchSettings();
          const existing = Array.isArray(s?.custom_couriers) ? (s!.custom_couriers as Array<any>) : [];
          if (existing.some((c) => String(c?.name).toLowerCase() === name.toLowerCase())) {
            toast.info(`Preset "${name}" sudah ada`);
            return;
          }
          await saveSettings({
            data: {
              origin_subdistrict_id: s.origin_subdistrict_id ?? "",
              origin_label: s.origin_label ?? "",
              logo_url: s.logo_url ?? null,
              active_couriers: Array.isArray(s.active_couriers) ? s.active_couriers : [],
              custom_couriers: [...existing, { name, price, description: "Custom", etd: "-" }],
            },
          });
          toast.success("Preset jasa kirim disimpan");
          setSavePreset(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Gagal menyimpan preset");
        } finally {
          setSavingPreset(false);
        }
      })();
    }
  }

  const isCodActive = form.payment_status === "cod" || String(form.source).toLowerCase().includes("cod");

  async function calcShipping(force = false) {
    if (!form.destination_subdistrict_id) return;
    const effectiveWeight = weight > 0 ? weight : 1000;
    const wh = warehousesQ.data?.find((w: any) => w.id === form.warehouse_id) as any;
    setLoadingCost(true);
    try {
      const r = await fetchCost({
        data: {
          destination_subdistrict_id: form.destination_subdistrict_id,
          weight_g: effectiveWeight,
          courier: "jne:sap:ninja:sicepat:jnt:pos:tiki:anteraja:ide:wahana:lion",
          origin_subdistrict_id: wh?.origin_subdistrict_id ?? null,
          is_cod: isCodActive,
          force_refresh: force,
        },
      });
      const rates = Array.isArray(r) ? r : (r as any)?.services ?? [];
      setServices(rates);
      setCostCached(!!(r as any)?.cached);
      if (force) toast.success("Ongkir diperbarui");
      else if (rates.length === 0) toast.warning("Tidak ada layanan pengiriman tersedia");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghitung ongkir");
    } finally {
      setLoadingCost(false);
    }
  }

  // Auto-calculate when destination or COD status is set (debounced)
  useEffect(() => {
    if (!form.destination_subdistrict_id) return;
    const t = setTimeout(() => { void calcShipping(false); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.destination_subdistrict_id, weight, form.warehouse_id, isCodActive]);

  const mut = useMutation({
    mutationFn: (payload: OrderInput) => save({ data: payload }),
    onSuccess: ({ id }) => {
      toast.success(form.id ? "Pesanan diperbarui" : "Pesanan dibuat");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      navigate({ to: "/orders/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  async function submit() {
    if (form.items.length === 0) return toast.error("Tambahkan minimal 1 produk");
    if (!form.customer_name || !form.customer_name.trim()) return toast.error("Nama pemesan wajib diisi");
    if (!form.phone || !form.phone.trim() || form.phone.trim().length < 3) return toast.error("Nomor telepon pemesan wajib diisi");

    if (!sameRecipient) {
      if (!form.recipient_name || !form.recipient_name.trim()) return toast.error("Nama penerima wajib diisi");
      if (!form.recipient_phone || !form.recipient_phone.trim() || form.recipient_phone.trim().length < 3) return toast.error("Nomor telepon penerima wajib diisi");
    }

    if (!form.full_address || !form.full_address.trim()) return toast.error("Alamat lengkap pengiriman wajib diisi");
    if (!form.destination_subdistrict_id) return toast.error("Pilih kecamatan tujuan pengiriman terlebih dahulu");
    if (!form.warehouse_id) return toast.error("Pilih gudang asal pengiriman terlebih dahulu");
    if (!form.service || !form.courier) return toast.error("Pilih ekspedisi dan layanan pengiriman terlebih dahulu");

    // Save any "Item custom → Simpan ke katalog" flagged items to the product catalog first.
    let items = form.items;
    try {
      const nextItems = await Promise.all(
        items.map(async (it, idx) => {
          const entry = getSaveEntry(idx);
          if (!entry.enabled || it.product_id) return it;
          if (!it.name || !it.name.trim() || it.name === "Item custom") {
            throw new Error(`Isi nama item baris ke-${idx + 1} sebelum menyimpan ke katalog`);
          }
          const color = entry.useColor ? entry.color.trim() : "";
          const size = entry.useSize ? entry.size.trim() : "";
          const res = await quickCreate({
            data: {
              name: it.name.trim(),
              price: Number(it.price) || 0,
              cost: Number(it.cost) || 0,
              weight_g: Number(it.weight_g) || 0,
              stock: Number(it.qty) || 0,
              color: color || null,
              size: size || null,
            },
          });
          const variantLbl = [color, size].filter(Boolean).join(" / ") || "Default";
          return { ...it, product_id: res.product_id, variant_id: res.variant_id, variant: variantLbl };
        }),
      );
      items = nextItems;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan produk baru");
      return;
    }

    if (items !== form.items) {
      setForm((f) => ({ ...f, items }));
      setSaveCatalog({});
      qc.invalidateQueries({ queryKey: ["products"] });
    }

    const payload: OrderInput = {
      ...form,
      items,
      shipping_cost: Number(form.shipping_cost) || 0,
      recipient_name: sameRecipient ? form.customer_name : form.recipient_name,
      recipient_phone: sameRecipient ? form.phone : form.recipient_phone,
    };
    mut.mutate(payload);
  }



  // ---- item helpers ----
  function variantLabel(v: any): string {
    if (!v) return "";
    const parts = [v.color, v.size].filter((x) => x && String(x).trim());
    if (parts.length > 0) return parts.join(" / ");
    return v.label ?? "";
  }
  function isPreorder(p: any) {
    return p?.product_type === "preorder";
  }
  function variantInStock(p: any, v: any) {
    if (!v) return false;
    if (isPreorder(p)) return true;
    return Number(v.stock ?? 0) > 0;
  }
  function productHasStock(p: any) {
    if (!p) return false;
    if (isPreorder(p)) return true;
    const variants: any[] = p.variants ?? [];
    if (variants.length === 0) return Number(p.stock ?? 0) > 0;
    return variants.some((v) => Number(v.stock ?? 0) > 0);
  }
  function addItem(productId?: string) {
    const p = productId ? productsQ.data?.find((x: any) => x.id === productId) : undefined;
    if (p && !productHasStock(p)) {
      toast.error(`Stok "${(p as any).name}" habis`);
      return;
    }
    const variants: any[] = (p as any)?.variants ?? [];
    const def =
      variants.find((v) => v.is_default && variantInStock(p, v)) ??
      variants.find((v) => variantInStock(p, v)) ??
      variants.find((v) => v.is_default) ??
      variants[0];
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          product_id: p?.id ?? null,
          variant_id: def?.id ?? null,
          name: p?.name ?? "Item custom",
          variant: variantLabel(def),
          qty: 1,
          price: def ? Number(def.price) : p ? Number((p as any).price) : 0,
          cost: def ? Number(def.cost) : p ? Number((p as any).cost ?? 0) : 0,
          weight_g: def ? Number(def.weight_g) : (p as any)?.weight_g ?? 0,
        },
      ],
    }));
  }
  function pickVariant(idx: number, variantId: string) {
    const item = form.items[idx];
    if (!item?.product_id) return;
    const p = productsQ.data?.find((x: any) => x.id === item.product_id) as any;
    const v = (p?.variants ?? []).find((x: any) => x.id === variantId);
    if (!v) return;
    if (!variantInStock(p, v)) {
      toast.error(`Varian "${variantLabel(v)}" stok habis`);
      return;
    }
    updateItem(idx, { variant_id: v.id, variant: variantLabel(v), price: Number(v.price), cost: Number(v.cost), weight_g: Number(v.weight_g) });
  }

  function updateItem(idx: number, patch: Partial<OrderInput["items"][number]>) {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }
  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  // barcode / SKU scan
  const [scan, setScan] = useState("");
  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = scan.trim();
    if (!q) return;
    const products: any[] = productsQ.data ?? [];
    for (const p of products) {
      for (const v of p.variants ?? []) {
        if (v.sku && v.sku.toLowerCase() === q.toLowerCase()) {
          if (!variantInStock(p, v)) {
            toast.error(`Stok "${p.name} · ${variantLabel(v)}" habis`);
            setScan("");
            return;
          }
          // find existing item
          const existingIdx = form.items.findIndex((it) => it.variant_id === v.id);
          if (existingIdx >= 0) {
            const nextQty = form.items[existingIdx].qty + 1;
            if (!isPreorder(p) && nextQty > Number(v.stock ?? 0)) {
              toast.error(`Qty melebihi stok (${v.stock})`);
              setScan("");
              return;
            }
            updateItem(existingIdx, { qty: nextQty });
          } else {
            setForm((f) => ({
              ...f,
              items: [
                ...f.items,
                {
                  product_id: p.id,
                  variant_id: v.id,
                  name: p.name,
                  variant: variantLabel(v),
                  qty: 1,
                  price: Number(v.price),
                  cost: Number(v.cost),
                  weight_g: Number(v.weight_g),
                },
              ],
            }));
          }
          setScan("");
          return;
        }
      }

    }
    toast.error(`SKU "${q}" tidak ditemukan`);
    setScan("");
  }

  if (existingId && existingQ.isLoading) return <Skeleton className="h-96" />;

  const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
            {form.id ? "Ubah Order" : "Buat Order"}
          </h1>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {today} · dari <span className="underline">{form.source || "App"}</span>
            <Pencil className="size-3 ml-1" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/orders" })}>Batal</Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? "Menyimpan..." : form.id ? "Simpan" : "Buat Order"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* LEFT: Produk + Pembayaran */}
        <div className="lg:col-span-2 space-y-4">
          {/* Produk */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Produk</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Select onValueChange={addItem}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="+ Tambah Produk" /></SelectTrigger>
                <SelectContent>
                  {(productsQ.data ?? []).map((p: any) => {
                    const vc = (p.variants ?? []).length;
                    const inStock = productHasStock(p);
                    const totalStock = (p.variants ?? []).reduce((s: number, v: any) => s + Number(v.stock ?? 0), 0);
                    return (
                      <SelectItem key={p.id} value={p.id} disabled={!inStock}>
                        {p.name}{vc > 1 ? ` · ${vc} variasi` : ""}
                        {!inStock ? " · Stok habis" : isPreorder(p) ? " · PO" : ` · stok ${totalStock}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[220px]">
                <ScanBarcode className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Scan barcode / ketik SKU + Enter"
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={handleScan}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => addItem()}>
                <Plus className="size-4 mr-1" />Item custom
              </Button>
            </div>

            <div className="mt-4 border rounded-md divide-y">
              {form.items.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">Belum ada item</p>
              )}
              {form.items.map((it, idx) => {
                const product = it.product_id
                  ? (productsQ.data as any[] | undefined)?.find((x) => x.id === it.product_id)
                  : null;
                const variants: any[] = product?.variants ?? [];
                return (
                  <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 sm:col-span-3">
                      <Label className="text-xs">Nama</Label>
                      <Input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <Label className="text-xs">Varian</Label>
                      {variants.length > 0 ? (
                        <Select value={it.variant_id ?? ""} onValueChange={(v) => pickVariant(idx, v)}>
                          <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                          <SelectContent>
                            {variants.map((v) => {
                              const ok = variantInStock(product, v);
                              return (
                                <SelectItem key={v.id} value={v.id} disabled={!ok}>
                                  {variantLabel(v)} · {formatIDR(Number(v.price))}
                                  {!ok ? " · habis" : isPreorder(product) ? " · PO" : ` · stok ${v.stock}`}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={it.variant ?? ""} onChange={(e) => updateItem(idx, { variant: e.target.value })} />
                      )}
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        max={product && !isPreorder(product) ? (() => {
                          const v = variants.find((x: any) => x.id === it.variant_id);
                          return v ? Number(v.stock) : undefined;
                        })() : undefined}
                        value={it.qty}
                        onChange={(e) => {
                          const q = Number(e.target.value);
                          const v = variants.find((x: any) => x.id === it.variant_id);
                          if (product && !isPreorder(product) && v && q > Number(v.stock)) {
                            toast.error(`Stok tersisa ${v.stock}`);
                            updateItem(idx, { qty: Number(v.stock) });
                            return;
                          }
                          updateItem(idx, { qty: q });
                        }}
                      />

                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <Label className="text-xs">Harga (Rp)</Label>
                      <Input type="number" value={it.price} onChange={(e) => updateItem(idx, { price: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-xs">Berat ({weightUnit})</Label>
                      <Input
                        type="number"
                        step={weightUnit === "kg" ? "0.001" : "1"}
                        value={wDisplay(it.weight_g)}
                        onChange={(e) => updateItem(idx, { weight_g: wGrams(Number(e.target.value)) })}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    {!it.product_id && (() => {
                      const entry = getSaveEntry(idx);
                      return (
                        <div className="col-span-12 rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={entry.enabled}
                              onCheckedChange={(v) => patchSaveEntry(idx, { enabled: !!v })}
                            />
                            <span>Simpan sebagai produk baru ke katalog</span>
                          </label>
                          {entry.enabled && (
                            <div className="pl-6 space-y-2">
                              <div className="flex flex-wrap gap-4 text-sm">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={entry.useColor}
                                    onCheckedChange={(v) => patchSaveEntry(idx, { useColor: !!v })}
                                  />
                                  <span>Tambah warna</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={entry.useSize}
                                    onCheckedChange={(v) => patchSaveEntry(idx, { useSize: !!v })}
                                  />
                                  <span>Tambah ukuran</span>
                                </label>
                              </div>
                              {(entry.useColor || entry.useSize) && (
                                <div className="grid grid-cols-2 gap-2">
                                  {entry.useColor && (
                                    <div>
                                      <Label className="text-xs">Warna</Label>
                                      <Input
                                        value={entry.color}
                                        placeholder="cth. Merah"
                                        onChange={(e) => patchSaveEntry(idx, { color: e.target.value })}
                                      />
                                    </div>
                                  )}
                                  {entry.useSize && (
                                    <div>
                                      <Label className="text-xs">Ukuran</Label>
                                      <Input
                                        value={entry.size}
                                        placeholder="cth. XL"
                                        onChange={(e) => patchSaveEntry(idx, { size: e.target.value })}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Nama, harga, modal, dan berat item akan tersimpan otomatis. Stok awal = qty pada baris ini.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-4 border rounded-md p-4 space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatIDR(subtotal)} />
              <Row label="Ongkir" value={formatIDR(shippingCost)} />
              {Boolean(discount > 0) && (
                <Row label="Diskon" value={`- ${formatIDR(discount)}`} valueClass="text-primary" />
              )}
              <div className="border-t pt-2 mt-2">
                <Row label={<span className="font-semibold">Total</span>} value={<span className="font-bold text-base">{formatIDR(total)}</span>} />
              </div>
              <div className={`flex justify-between pt-1 text-xs ${estProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                <span>Estimasi profit</span>
                <span className="font-mono">{formatIDR(estProfit)}</span>
              </div>
            </div>
          </Card>

          {/* Pembayaran & Sumber */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Pembayaran & Sumber Pesanan</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Status Pembayaran<span className="text-destructive">*</span></Label>
                <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Belum Bayar</SelectItem>
                    <SelectItem value="paid">Lunas</SelectItem>
                    <SelectItem value="partial">DP / Cicilan</SelectItem>
                    <SelectItem value="refunded">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Diskon (Rp)</Label>
                <Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Sumber Pesanan</Label>
                <Select value={form.source ?? ""} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue placeholder="Sumber" /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>


        {/* RIGHT: Pelanggan + Pengiriman */}
        <div className="space-y-4">
          {/* Pelanggan */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Pelanggan</h2>
            <div className="space-y-3">
              <div className="relative">
                <Label>Nama pemesan<span className="text-destructive">*</span></Label>
                <div className="relative mt-1">
                  <Input
                    value={form.customer_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => ({ ...f, customer_name: val }));
                      setCustomerSearchQ(val);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Nama pemesan / inisial..."
                  />
                  {customerSearchQuery.isFetching && (
                    <Loader2 className="size-4 animate-spin text-primary absolute right-3 top-2.5" />
                  )}
                </div>

                {showCustomerDropdown && customerSearchQ.trim().length >= 1 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-60 overflow-auto">
                    {customerSearchQuery.isFetching && (
                      <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        Mencari inisial/nama pelanggan...
                      </div>
                    )}
                    {!customerSearchQuery.isFetching && customerSearchQuery.data?.length === 0 && (
                      <div className="p-3 text-xs text-muted-foreground">Tidak ada pelanggan dengan inisial tersebut</div>
                    )}
                    {!customerSearchQuery.isFetching && (customerSearchQuery.data ?? []).map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left p-2.5 hover:bg-accent border-b last:border-0 text-xs transition"
                        onClick={() => {
                          const addr = (c.last_address as any) || {};
                          setForm((f) => ({
                            ...f,
                            customer_name: c.name,
                            phone: c.phone || f.phone,
                            full_address: addr.full_address || f.full_address,
                            city: addr.city || f.city,
                            province: addr.province || f.province,
                            district: addr.district || f.district,
                            postal_code: addr.postal_code || f.postal_code,
                            destination_subdistrict_id: addr.destination_subdistrict_id || f.destination_subdistrict_id,
                            destination_label: addr.destination_label || f.destination_label,
                            shipping_cost: 0,
                            courier: "",
                            service: "",
                          }));
                          setShowCustomerDropdown(false);
                          toast.info(`Pelanggan "${c.name}" dipilih`);
                        }}
                      >
                        <div className="font-medium text-sm text-foreground">{c.name}</div>
                        <div className="text-muted-foreground text-[11px] mt-0.5">{c.phone} {(c.last_address as any)?.full_address ? `· ${(c.last_address as any).full_address}` : ""}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Telepon pemesan<span className="text-destructive">*</span></Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  onBlur={(e) => tryAutofill(e.target.value)}
                  placeholder="0812..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <Switch id="same" checked={sameRecipient} onCheckedChange={setSameRecipient} />
                <Label htmlFor="same" className="cursor-pointer">Penerima sama dengan pemesan</Label>
              </div>

              {!sameRecipient && (
                <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                  <div className="relative">
                    <Label>Nama penerima<span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <Input
                        value={form.recipient_name ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((f) => ({ ...f, recipient_name: val }));
                          setRecipientSearchQ(val);
                          setShowRecipientDropdown(true);
                        }}
                        onFocus={() => setShowRecipientDropdown(true)}
                        placeholder="Nama penerima / inisial..."
                      />
                      {recipientSearchQuery.isFetching && (
                        <Loader2 className="size-4 animate-spin text-primary absolute right-3 top-2.5" />
                      )}
                    </div>

                    {showRecipientDropdown && recipientSearchQ.trim().length >= 1 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-60 overflow-auto">
                        {recipientSearchQuery.isFetching && (
                          <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="size-3.5 animate-spin text-primary" />
                            Mencari inisial/nama penerima...
                          </div>
                        )}
                        {!recipientSearchQuery.isFetching && recipientSearchQuery.data?.length === 0 && (
                          <div className="p-3 text-xs text-muted-foreground">Tidak ada penerima dengan inisial tersebut</div>
                        )}
                        {!recipientSearchQuery.isFetching && (recipientSearchQuery.data ?? []).map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left p-2.5 hover:bg-accent border-b last:border-0 text-xs transition"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                recipient_name: c.name,
                                recipient_phone: f.recipient_phone || c.phone,
                                full_address: f.full_address || (c.last_address as any)?.full_address || "",
                                city: f.city || (c.last_address as any)?.city || "",
                                province: f.province || (c.last_address as any)?.province || "",
                                district: f.district || (c.last_address as any)?.district || "",
                                postal_code: f.postal_code || (c.last_address as any)?.postal_code || "",
                                destination_subdistrict_id: f.destination_subdistrict_id || (c.last_address as any)?.destination_subdistrict_id || "",
                                destination_label: f.destination_label || (c.last_address as any)?.destination_label || "",
                              }));
                              setShowRecipientDropdown(false);
                              toast.info(`Penerima "${c.name}" dipilih`);
                            }}
                          >
                            <div className="font-medium text-sm text-foreground">{c.name}</div>
                            <div className="text-muted-foreground text-[11px] mt-0.5">{c.phone} {(c.last_address as any)?.full_address ? `· ${(c.last_address as any).full_address}` : ""}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Telepon penerima</Label>
                    <Input value={form.recipient_phone ?? ""} onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })} />
                  </div>
                </div>
              )}

            </div>
          </Card>

          {/* Dropship */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Dropship</h2>
              <Switch checked={form.is_dropship} onCheckedChange={(v) => setForm({ ...form, is_dropship: v })} />
            </div>
            {form.is_dropship && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <Label>Nama pengirim (dropshipper)</Label>
                  <Input value={form.dropship_name ?? ""} onChange={(e) => setForm({ ...form, dropship_name: e.target.value })} />
                </div>
                <div>
                  <Label>Telepon pengirim</Label>
                  <Input value={form.dropship_phone ?? ""} onChange={(e) => setForm({ ...form, dropship_phone: e.target.value })} />
                </div>
              </div>
            )}
          </Card>

          {/* Pengiriman */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Pengiriman</h2>
            <div className="space-y-3">


              <div>
                <Label>Alamat lengkap<span className="text-destructive">*</span></Label>
                <Textarea rows={2} value={form.full_address} onChange={(e) => setForm({ ...form, full_address: e.target.value })} />
              </div>

              <div>
                <Label>Kecamatan Penerima<span className="text-destructive">*</span></Label>
                {form.destination_subdistrict_id ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{form.destination_label || form.city}</div>
                      <div className="text-xs text-muted-foreground">ID: {form.destination_subdistrict_id}</div>
                    </div>
                    <Button type="button" size="sm" variant="ghost"
                      onClick={() => setForm((f) => ({ ...f, destination_subdistrict_id: "", destination_label: "", city: "", province: "", district: "" }))}>
                      Ganti
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Input
                      placeholder="Ketikan minimal 3 huruf awal kecamatan..."
                      value={cityQ}
                      onChange={(e) => setCityQ(e.target.value)}
                      className="rounded-none border-0 border-b focus-visible:ring-0"
                    />
                    <div className="max-h-48 overflow-auto">
                      {(citiesQuery.data ?? []).map((c: Destination) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              destination_subdistrict_id: c.id,
                              destination_label: c.label,
                              city: c.city_name,
                              province: c.province_name,
                              district: c.district_name,
                              postal_code: f.postal_code || c.zip_code,
                            }));
                            setCityQ("");
                          }}
                        >
                          <div className="font-medium">{c.district_name || c.subdistrict_name}, {c.city_name}</div>
                          <div className="text-xs text-muted-foreground">{c.province_name} {c.zip_code ? `· ${c.zip_code}` : ""}</div>
                        </button>
                      ))}
                      {cityQ.trim().length >= 3 && !citiesQuery.isLoading && (citiesQuery.data?.length ?? 0) === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">Tidak ada kecamatan ditemukan</div>
                      )}
                      {cityQ.trim().length < 3 && (
                        <div className="p-3 text-sm text-muted-foreground">Ketikan minimal 3 huruf awal kecamatan...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>



              <div>
                <Label>Gudang<span className="text-destructive">*</span></Label>
                <Select value={form.warehouse_id ?? ""} onValueChange={(v) => setForm({ ...form, warehouse_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih gudang asal" /></SelectTrigger>
                  <SelectContent>
                    {(warehousesQ.data ?? []).map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}{w.origin_label ? ` · ${w.origin_label.split(",")[0]}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <Label className="mb-0">Pilih Ekspedisi</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-primary">
                          <Info className="size-3" />
                          Skema Diskon & COD
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
                        <DialogHeader>
                          <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <span>Ketentuan Diskon Ongkir & COD Lincah.id</span>
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 text-sm mt-2">
                          <p className="text-xs text-muted-foreground">
                            Berikut adalah tabel skema diskon ongkir resmi, biaya COD (3.33%), dan ketentuan khusus pengembalian paket (Return Fee) Lincah.id:
                          </p>
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-xs text-left border-collapse">
                              <thead className="bg-muted font-semibold border-b">
                                <tr>
                                  <th className="p-2 border-r">Layanan Kurir</th>
                                  <th className="p-2 border-r">Metode</th>
                                  <th className="p-2 border-r">Diskon</th>
                                  <th className="p-2 border-r">COD Fee</th>
                                  <th className="p-2">Ketentuan Khusus</th>
                                </tr>
                              </thead>
                              <tbody>
                                {LINCAH_DISCOUNT_TABLE.map((row, idx) => (
                                  <tr key={idx} className="border-b hover:bg-muted/50 transition">
                                    <td className="p-2 font-medium border-r">{row.courier_name}</td>
                                    <td className="p-2 border-r">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.is_cod ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-muted text-muted-foreground"}`}>
                                        {row.is_cod ? "COD" : "Non-COD"}
                                      </span>
                                    </td>
                                    <td className="p-2 font-semibold text-emerald-600 border-r">{row.discount_percent}%</td>
                                    <td className="p-2 border-r">{row.cod_fee_percent > 0 ? `${row.cod_fee_percent}%` : "-"}</td>
                                    <td className="p-2 text-muted-foreground">{row.special_terms}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void calcShipping(true)}
                    disabled={loadingCost || !form.destination_subdistrict_id}
                    className="h-7 text-xs"
                  >
                    {loadingCost ? <Loader2 className="size-3 animate-spin mr-1" /> : <Truck className="size-3 mr-1" />}
                    {costCached ? "Perbarui" : "Refresh"}
                  </Button>
                </div>
                {!form.destination_subdistrict_id && (
                  <p className="text-xs text-muted-foreground">Pilih tujuan dulu untuk menghitung ongkir</p>
                )}
                {loadingCost && services.length === 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Menghitung ongkir…</p>
                )}
                {costCached && services.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-1">Dari cache · klik Perbarui untuk cek ulang</p>
                )}
                {services.length > 0 && (
                  <div className="space-y-1 max-h-64 overflow-auto">
                    {services.map((s, i) => (
                      <button
                        key={`${s.courier_code ?? "c"}-${s.service}-${i}`}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, service: s.service, courier: s.custom ? "custom" : (s.courier_code || f.courier || "jne"), shipping_cost: s.value, eta: s.etd }))}
                        className={`w-full text-left border rounded-md p-2.5 hover:bg-accent transition text-sm ${
                          form.service === s.service && (s.custom ? form.courier === "custom" : form.courier === s.courier_code) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium flex items-center gap-1.5 flex-wrap">
                              <span>
                                {s.custom
                                  ? s.service
                                  : `${s.courier_code?.toUpperCase() || s.courier_name || ""} ${s.service}`}
                              </span>
                              {Boolean(s.discount_percent && s.discount_percent > 0) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Diskon {s.discount_percent}%
                                </span>
                              )}
                              {Boolean(s.cod_fee_percent && s.cod_fee_percent > 0) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  COD Fee {s.cod_fee_percent}%
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {s.description}{s.etd ? ` · ${s.etd} hari` : ""}
                            </div>
                            {s.special_terms && (
                              <div className="text-[10px] text-muted-foreground/80 mt-0.5 italic">
                                ℹ️ {s.special_terms}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatIDR(s.value)}
                            </div>
                            {Boolean(s.original_value && s.original_value > s.value) && (
                              <div className="font-mono text-[11px] line-through text-muted-foreground mt-0.5">
                                {formatIDR(s.original_value)}
                              </div>
                            )}
                          </div>
                        </div>
                        {Boolean(s.original_value && s.original_value > s.value) && (
                          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 border-t pt-1 flex justify-between items-center">
                            <span>Harga setelah diskon</span>
                            <span>Hemat {formatIDR(s.original_value - s.value)}</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>


              {/* Custom courier inline toggle */}
              <div className="border rounded-md p-3 bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium cursor-pointer" onClick={() => setShowCustomCourier(!showCustomCourier)}>
                      Jasa Kirim Custom / Manual
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Input ongkir manual untuk kurir toko, Gojek, Grab, dll.
                    </p>
                  </div>
                  <Switch
                    checked={showCustomCourier}
                    onCheckedChange={(on) => {
                      setShowCustomCourier(on);
                      if (!on && form.courier === "custom") {
                        setForm((f) => ({ ...f, courier: "", service: "", shipping_cost: 0 }));
                      }
                    }}
                  />
                </div>

                {showCustomCourier && (
                  <div className="pt-3 border-t space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
                      <Input
                        placeholder="Nama ekspedisi (mis. Gojek, Grab, Kurir Toko)"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ongkir (Rp)"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={applyCustomCourier}
                        disabled={!customName.trim() || customPrice === "" || savingPreset}
                      >
                        {savingPreset ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                        Gunakan
                      </Button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={savePreset}
                        onChange={(e) => setSavePreset(e.target.checked)}
                        className="rounded border-input"
                      />
                      Simpan sebagai preset (muncul otomatis di order berikutnya)
                    </label>
                  </div>
                )}
              </div>



              <div>
                <Label>Ongkir final (Rp)</Label>
                <Input type="number" value={form.shipping_cost} onChange={(e) => setForm({ ...form, shipping_cost: Number(e.target.value) })} />
              </div>


              <div>
                <Label>No. Resi</Label>
                <Input value={form.tracking_number ?? ""} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} />
              </div>

              <div>
                <Label>Catatan</Label>
                <Textarea rows={3} placeholder="Masukkan catatan di sini…" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>

              <div className="flex items-center gap-2">
                <Switch id="ins" checked={form.insurance} onCheckedChange={(v) => setForm({ ...form, insurance: v })} />
                <Label htmlFor="ins" className="cursor-pointer">Pakai asuransi</Label>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-6 mt-6 border-t">
        <Button variant="outline" onClick={() => navigate({ to: "/orders" })}>Batal</Button>
        <Button onClick={submit} disabled={mut.isPending}>
          {mut.isPending ? "Menyimpan..." : form.id ? "Simpan perubahan" : "Buat pesanan"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: React.ReactNode; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

export const Route = NewRoute;
export { OrderForm };
export const PAGE_EDIT = "/_authenticated/orders/$id/edit";
