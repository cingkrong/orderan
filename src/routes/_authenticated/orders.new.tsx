import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { saveOrder, getOrder, type OrderInput } from "@/lib/orders.functions";
import { listProducts } from "@/lib/products.functions";
import { getCustomerByPhone } from "@/lib/customers.functions";
import { searchDestinations, getShippingCost, type Destination } from "@/lib/shipping.functions";
import { listWarehouses } from "@/lib/warehouses.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Truck, Loader2, ScanBarcode, Pencil } from "lucide-react";
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

  const productsQ = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const warehousesQ = useQuery({ queryKey: ["warehouses"], queryFn: () => fetchWarehouses() });
  const existingQ = useQuery({
    queryKey: ["order", existingId],
    queryFn: () => fetchOrder({ data: { id: existingId! } }),
    enabled: !!existingId,
  });

  const [form, setForm] = useState<OrderInput>(emptyForm);
  const [sameRecipient, setSameRecipient] = useState(true);

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

  async function tryAutofill(phone: string) {
    if (phone.length < 6) return;
    try {
      const c = await fetchCustomer({ data: { phone } });
      if (c) {
        setForm((f) => ({
          ...f,
          customer_name: f.customer_name || c.name,
          full_address: f.full_address || (c.last_address as any)?.full_address || "",
          city: f.city || (c.last_address as any)?.city || "",
          province: f.province || (c.last_address as any)?.province || "",
          district: f.district || (c.last_address as any)?.district || "",
          postal_code: f.postal_code || (c.last_address as any)?.postal_code || "",
          destination_subdistrict_id: f.destination_subdistrict_id || (c.last_address as any)?.destination_subdistrict_id || "",
          destination_label: f.destination_label || (c.last_address as any)?.destination_label || "",
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
  const [services, setServices] = useState<Array<{ service: string; description: string; value: number; etd: string; custom?: boolean }>>([]);
  const [loadingCost, setLoadingCost] = useState(false);
  const [costCached, setCostCached] = useState(false);

  async function calcShipping(force = false) {
    if (!form.destination_subdistrict_id) return;
    if (!weight) return;
    const wh = warehousesQ.data?.find((w: any) => w.id === form.warehouse_id) as any;
    setLoadingCost(true);
    try {
      const r = await fetchCost({
        data: {
          destination_subdistrict_id: form.destination_subdistrict_id,
          weight_g: weight,
          courier: "jne:sicepat:jnt:pos:tiki:anteraja:ide:wahana",
          origin_subdistrict_id: wh?.origin_subdistrict_id ?? null,
          force_refresh: force,
        },
      });
      setServices(r.services);
      setCostCached(!!r.cached);
      if (force) toast.success("Ongkir diperbarui");
      else if (r.services.length === 0) toast.warning("Tidak ada layanan tersedia");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoadingCost(false);
    }
  }

  // Auto-calculate when destination + weight + warehouse are set (debounced)
  useEffect(() => {
    if (!form.destination_subdistrict_id || !weight || !form.warehouse_id) return;
    const t = setTimeout(() => { void calcShipping(false); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.destination_subdistrict_id, weight, form.warehouse_id]);

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

  function submit() {
    if (form.items.length === 0) return toast.error("Tambahkan minimal satu produk");
    const parsed = z.string().min(3).safeParse(form.customer_name);
    if (!parsed.success) return toast.error("Nama pelanggan wajib diisi");
    const payload: OrderInput = {
      ...form,
      shipping_cost: Number(form.shipping_cost) || 0,
      recipient_name: sameRecipient ? "" : form.recipient_name,
      recipient_phone: sameRecipient ? "" : form.recipient_phone,
    };
    mut.mutate(payload);
  }

  // ---- item helpers ----
  function addItem(productId?: string) {
    const p = productId ? productsQ.data?.find((x: any) => x.id === productId) : undefined;
    const variants: any[] = (p as any)?.variants ?? [];
    const def = variants.find((v) => v.is_default) ?? variants[0];
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          product_id: p?.id ?? null,
          variant_id: def?.id ?? null,
          name: p?.name ?? "Item custom",
          variant: def?.label ?? "",
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
    updateItem(idx, { variant_id: v.id, variant: v.label, price: Number(v.price), cost: Number(v.cost), weight_g: Number(v.weight_g) });
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
          // find existing item
          const existingIdx = form.items.findIndex((it) => it.variant_id === v.id);
          if (existingIdx >= 0) {
            updateItem(existingIdx, { qty: form.items[existingIdx].qty + 1 });
          } else {
            setForm((f) => ({
              ...f,
              items: [
                ...f.items,
                {
                  product_id: p.id,
                  variant_id: v.id,
                  name: p.name,
                  variant: v.label,
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
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{vc > 1 ? ` · ${vc} variasi` : ""}
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
                            {variants.map((v) => (
                              <SelectItem key={v.id} value={v.id}>{v.label} · {formatIDR(Number(v.price))}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={it.variant ?? ""} onChange={(e) => updateItem(idx, { variant: e.target.value })} />
                      )}
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" min={1} value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Label className="text-xs">Modal</Label>
                      <Input type="number" value={it.cost} onChange={(e) => updateItem(idx, { cost: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <Label className="text-xs">Harga</Label>
                      <Input type="number" value={it.price} onChange={(e) => updateItem(idx, { price: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-4 sm:col-span-1">
                      <Label className="text-xs">Berat (g)</Label>
                      <Input type="number" value={it.weight_g} onChange={(e) => updateItem(idx, { weight_g: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-4 border rounded-md p-4 space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatIDR(subtotal)} />
              <Row label="Ongkir" value={formatIDR(shippingCost)} />
              <Row label="Diskon" value={`- ${formatIDR(discount)}`} valueClass="text-primary" />
              <Row label="Fee marketplace" value={`- ${formatIDR(marketplaceFee)}`} valueClass="text-primary" />
              <div className="border-t pt-2 mt-2">
                <Row label={<span className="font-semibold">Total</span>} value={<span className="font-bold text-base">{formatIDR(total)}</span>} />
              </div>
              <div className={`flex justify-between pt-1 text-xs ${estProfit >= 0 ? "text-success" : "text-destructive"}`}>
                <span>Estimasi profit</span>
                <span className="font-mono">{formatIDR(estProfit)}</span>
              </div>
            </div>
          </Card>

          {/* Pembayaran */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Pembayaran</h2>
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
                <Label>Fee marketplace (Rp)</Label>
                <Input type="number" value={form.marketplace_fee} onChange={(e) => setForm({ ...form, marketplace_fee: Number(e.target.value) })} />
              </div>
            </div>
          </Card>

          {/* Sumber */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Sumber Pesanan</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Sumber</Label>
                <Select value={form.source ?? ""} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue placeholder="Sumber" /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kampanye</Label>
                <Input value={form.campaign ?? ""} onChange={(e) => setForm({ ...form, campaign: e.target.value })} />
              </div>
              <div>
                <Label>Ref / afiliasi</Label>
                <Input value={form.ref ?? ""} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
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
              <div>
                <Label>Nama pemesan<span className="text-destructive">*</span></Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
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
                  <div>
                    <Label>Nama penerima<span className="text-destructive">*</span></Label>
                    <Input value={form.recipient_name ?? ""} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} />
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
                <Label>Tujuan (kelurahan)</Label>
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
                      placeholder="Cari kelurahan/kota (min. 3 huruf)…"
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
                          <div className="font-medium">{c.subdistrict_name}, {c.district_name}</div>
                          <div className="text-xs text-muted-foreground">{c.city_name} · {c.zip_code}</div>
                        </button>
                      ))}
                      {cityQ.trim().length >= 3 && !citiesQuery.isLoading && (citiesQuery.data?.length ?? 0) === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">Tidak ada hasil</div>
                      )}
                      {cityQ.trim().length < 3 && (
                        <div className="p-3 text-sm text-muted-foreground">Ketik minimal 3 huruf…</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input value={form.district ?? ""} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="Kecamatan" />
                <Input value={form.postal_code ?? ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="Kode pos" />
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
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="mb-0">Pilih Ekspedisi</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void calcShipping(true)}
                    disabled={loadingCost || !form.destination_subdistrict_id || !weight}
                    className="h-7 text-xs"
                  >
                    {loadingCost ? <Loader2 className="size-3 animate-spin mr-1" /> : <Truck className="size-3 mr-1" />}
                    {costCached ? "Perbarui" : "Refresh"}
                  </Button>
                </div>
                {!form.destination_subdistrict_id && (
                  <p className="text-xs text-muted-foreground">Pilih tujuan dulu untuk menghitung ongkir</p>
                )}
                {form.destination_subdistrict_id && !weight && (
                  <p className="text-xs text-muted-foreground">Tambah produk dulu (berat = 0)</p>
                )}
                {loadingCost && services.length === 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Menghitung ongkir…</p>
                )}
                {costCached && services.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-1">Dari cache · klik Perbarui untuk cek ulang</p>
                )}
                {services.length > 0 && (
                  <div className="space-y-1 max-h-64 overflow-auto">
                    {services.map((s) => (
                      <button
                        key={s.service}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, service: s.service, courier: s.custom ? "custom" : (f.courier || "jne"), shipping_cost: s.value, eta: s.etd }))}
                        className={`w-full text-left border rounded-md p-2 hover:bg-accent transition text-sm ${
                          form.service === s.service ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {s.service} {s.custom && <span className="text-[10px] bg-warning/20 text-warning-foreground px-1 rounded ml-1">CUSTOM</span>}
                          </div>
                          <div className="font-mono text-sm">{formatIDR(s.value)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{s.description}{s.etd ? ` · ${s.etd} hari` : ""}</div>
                      </button>
                    ))}
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
