import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { saveOrder, getOrder, type OrderInput } from "@/lib/orders.functions";
import { listProducts } from "@/lib/products.functions";
import { getCustomerByPhone } from "@/lib/customers.functions";
import { searchDestinations, getShippingCost, type Destination } from "@/lib/shipping.functions";
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
import { Plus, Trash2, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatIDR, SOURCES, COURIERS, COURIER_LABEL } from "@/lib/format";

const PAGE_NEW = "/_authenticated/orders/new";
const PAGE_EDIT = "/_authenticated/orders/$id/edit";

export const NewRoute = createFileRoute(PAGE_NEW)({ component: () => <OrderForm /> });

function OrderForm({ existingId }: { existingId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveOrder);
  const fetchProducts = useServerFn(listProducts);
  const fetchCustomer = useServerFn(getCustomerByPhone);
  const fetchCities = useServerFn(searchDestinations);
  const fetchCost = useServerFn(getShippingCost);
  const fetchOrder = useServerFn(getOrder);

  const productsQ = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });

  const existingQ = useQuery({
    queryKey: ["order", existingId],
    queryFn: () => fetchOrder({ data: { id: existingId! } }),
    enabled: !!existingId,
  });

  const [form, setForm] = useState<OrderInput>({
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
    items: [],
  });

  useEffect(() => {
    if (existingQ.data) {
      const { order, items } = existingQ.data;
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
        source: order.source ?? "",
        campaign: order.campaign ?? "",
        ref: order.ref ?? "",
        shipping_cost: Number(order.shipping_cost ?? 0),
        discount: Number((order as any).discount ?? 0),
        marketplace_fee: Number((order as any).marketplace_fee ?? 0),
        eta: order.eta ?? "",
        insurance: order.insurance,
        routing_code: order.routing_code ?? "",
        note: order.note ?? "",
        is_dropship: (order as any).is_dropship ?? false,
        dropship_name: (order as any).dropship_name ?? "",
        dropship_phone: (order as any).dropship_phone ?? "",
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: (i as any).variant_id ?? null,
          name: i.name,
          variant: i.variant,
          qty: i.qty,
          price: Number(i.price),
          cost: Number((i as any).cost ?? 0),
          weight_g: i.weight_g,
        })),
      });
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

  // Phone -> customer autofill
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
          destination_city_id: f.destination_city_id || (c.last_address as any)?.destination_city_id || "",
          destination_subdistrict_id: f.destination_subdistrict_id || (c.last_address as any)?.destination_subdistrict_id || "",
          destination_label: f.destination_label || (c.last_address as any)?.destination_label || "",
        }));
        toast.info(`Data ${c.name} dimuat dari pesanan sebelumnya`);
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
  const [services, setServices] = useState<Array<{ service: string; description: string; value: number; etd: string }>>([]);
  const [loadingCost, setLoadingCost] = useState(false);

  async function calcShipping() {
    if (!form.destination_subdistrict_id) return toast.error("Pilih tujuan dulu");
    if (!weight) return toast.error("Tambah produk dulu");
    setLoadingCost(true);
    try {
      const r = await fetchCost({
        data: {
          destination_subdistrict_id: form.destination_subdistrict_id,
          weight_g: weight,
          courier: form.courier || "jne:sicepat:jnt:pos:tiki:anteraja:ide:wahana",
        },
      });
      setServices(r.services);
      if (r.services.length === 0) toast.warning("Tidak ada layanan tersedia");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoadingCost(false);
    }
  }

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
    mut.mutate({ ...form, shipping_cost: Number(form.shipping_cost) || 0 });
  }

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
          name: p?.name ?? "",
          variant: def?.label ?? "",
          qty: 1,
          price: def ? Number(def.price) : p ? Number(p.price) : 0,
          cost: def ? Number(def.cost) : p ? Number((p as any).cost ?? 0) : 0,
          weight_g: def ? Number(def.weight_g) : p?.weight_g ?? 0,
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
    updateItem(setForm, idx, {
      variant_id: v.id,
      variant: v.label,
      price: Number(v.price),
      cost: Number(v.cost),
      weight_g: Number(v.weight_g),
    });
  }

  if (existingId && existingQ.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {form.id ? `Ubah pesanan` : "Pesanan baru"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Fast entry — phone autofills, courier auto-calculates.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <h2 className="font-semibold">Customer</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Telepon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={(e) => tryAutofill(e.target.value)}
                placeholder="0812..."
              />
            </div>
            <div>
              <Label>Nama pelanggan</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Alamat lengkap</Label>
            <Textarea
              rows={2}
              value={form.full_address}
              onChange={(e) => setForm({ ...form, full_address: e.target.value })}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Tujuan (kelurahan)</Label>
              {form.destination_subdistrict_id ? (
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{form.destination_label || form.city}</div>
                    <div className="text-xs text-muted-foreground">ID: {form.destination_subdistrict_id}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        destination_subdistrict_id: "",
                        destination_label: "",
                        destination_city_id: "",
                        city: "",
                        province: "",
                        district: "",
                      }))
                    }
                  >
                    Ganti
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Input
                    placeholder="Cari kelurahan/kecamatan/kota (min. 3 huruf)…"
                    value={cityQ}
                    onChange={(e) => setCityQ(e.target.value)}
                    className="rounded-none border-0 border-b focus-visible:ring-0"
                  />
                  <div className="max-h-64 overflow-auto">
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
                        <div className="text-xs text-muted-foreground">{c.city_name} · {c.province_name} · {c.zip_code}</div>
                      </button>
                    ))}
                    {cityQ.trim().length >= 3 && !citiesQuery.isLoading && (citiesQuery.data?.length ?? 0) === 0 && (
                      <div className="p-3 text-sm text-muted-foreground">Tidak ada hasil</div>
                    )}
                    {cityQ.trim().length < 3 && (
                      <div className="p-3 text-sm text-muted-foreground">Ketik minimal 3 huruf…</div>
                    )}
                    {citiesQuery.isLoading && (
                      <div className="p-3 text-sm text-muted-foreground">Mencari…</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label>Kecamatan / Kode pos</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input value={form.district ?? ""} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="Kecamatan" />
                <Input value={form.postal_code ?? ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="Kode pos" />
              </div>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Kirim sebagai dropship</Label>
                <p className="text-xs text-muted-foreground">Nama & telepon pengirim di label akan diganti dengan data dropshipper.</p>
              </div>
              <Switch
                checked={form.is_dropship}
                onCheckedChange={(v) => setForm({ ...form, is_dropship: v })}
              />
            </div>
            {form.is_dropship && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nama pengirim (dropshipper)</Label>
                  <Input
                    value={form.dropship_name ?? ""}
                    onChange={(e) => setForm({ ...form, dropship_name: e.target.value })}
                    placeholder="cth. Toko Aisyah"
                  />
                </div>
                <div>
                  <Label>Telepon pengirim (dropshipper)</Label>
                  <Input
                    value={form.dropship_phone ?? ""}
                    onChange={(e) => setForm({ ...form, dropship_phone: e.target.value })}
                    placeholder="0812..."
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Order channel</h2>
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
        </Card>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Products</h2>
          <Select onValueChange={addItem}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Tambah produk…" /></SelectTrigger>
            <SelectContent>
              {(productsQ.data ?? []).map((p: any) => {
                const vc = (p.variants ?? []).length;
                return (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{vc > 1 ? ` · ${vc} variasi` : ""}
                  </SelectItem>
                );
              })}
              <SelectItem value="__custom">+ Item custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          {form.items.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Belum ada item</p>}
          {form.items.map((it, idx) => {
            const product = it.product_id
              ? (productsQ.data as any[] | undefined)?.find((x) => x.id === it.product_id)
              : null;
            const variants: any[] = product?.variants ?? [];
            return (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-3">
                <Label className="text-xs">Nama</Label>
                <Input value={it.name} onChange={(e) => updateItem(setForm, idx, { name: e.target.value })} />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Label className="text-xs">Varian</Label>
                {variants.length > 0 ? (
                  <Select value={it.variant_id ?? ""} onValueChange={(v) => pickVariant(idx, v)}>
                    <SelectTrigger><SelectValue placeholder="Pilih varian" /></SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label} · {formatIDR(Number(v.price))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={it.variant ?? ""} onChange={(e) => updateItem(setForm, idx, { variant: e.target.value })} />
                )}
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min={1} value={it.qty} onChange={(e) => updateItem(setForm, idx, { qty: Number(e.target.value) })} />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Label className="text-xs">Modal</Label>
                <Input type="number" value={it.cost} onChange={(e) => updateItem(setForm, idx, { cost: Number(e.target.value) })} />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Label className="text-xs">Harga jual</Label>
                <Input type="number" value={it.price} onChange={(e) => updateItem(setForm, idx, { price: Number(e.target.value) })} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <Label className="text-xs">Berat (g)</Label>
                <Input type="number" value={it.weight_g} onChange={(e) => updateItem(setForm, idx, { weight_g: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="col-span-12 text-xs text-muted-foreground pl-1">
                Profit item: <span className="font-mono">{formatIDR((it.price - (it.cost || 0)) * it.qty)}</span>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => addItem()}><Plus className="size-4 mr-1" />Tambah item custom</Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Shipping</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <Label>Kurir</Label>
            <Select value={form.courier ?? ""} onValueChange={(v) => setForm({ ...form, courier: v, service: "", shipping_cost: 0, eta: "" })}>
              <SelectTrigger><SelectValue placeholder="Kurir" /></SelectTrigger>
              <SelectContent>
                {COURIERS.map((c) => <SelectItem key={c} value={c}>{COURIER_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <Button onClick={calcShipping} disabled={loadingCost} className="w-full">
              {loadingCost ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Truck className="size-4 mr-1" />}
              Hitung ({Math.round(weight)}g)
            </Button>
          </div>
          <div>
            <Label>Asuransi</Label>
            <div className="h-9 flex items-center">
              <Switch checked={form.insurance} onCheckedChange={(v) => setForm({ ...form, insurance: v })} />
            </div>
          </div>
        </div>
        {services.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-2">
            {services.map((s) => (
              <button
                key={s.service}
                onClick={() => setForm((f) => ({ ...f, service: s.service, shipping_cost: s.value, eta: s.etd }))}
                className={`text-left border rounded-md p-3 hover:bg-accent transition ${
                  form.service === s.service ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="font-semibold">{s.service} <span className="text-xs text-muted-foreground">({s.description})</span></div>
                <div className="text-sm">{formatIDR(s.value)} · {s.etd} hari</div>
              </button>
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Ongkir (Rp)</Label>
            <Input type="number" value={form.shipping_cost} onChange={(e) => setForm({ ...form, shipping_cost: Number(e.target.value) })} />
          </div>
          <div>
            <Label>No. resi</Label>
            <Input value={form.tracking_number ?? ""} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} />
          </div>
          <div>
            <Label>Kode routing</Label>
            <Input value={form.routing_code ?? ""} onChange={(e) => setForm({ ...form, routing_code: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Catatan</Label>
          <Textarea rows={2} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Ringkasan & Profit</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Diskon / Voucher (Rp)</Label>
            <Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Fee marketplace / COD (Rp)</Label>
            <Input type="number" value={form.marketplace_fee} onChange={(e) => setForm({ ...form, marketplace_fee: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 items-start">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatIDR(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span className="font-mono">- {formatIDR(discount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ongkir</span><span className="font-mono">{formatIDR(shippingCost)}</span></div>
            <div className="flex justify-between text-base font-semibold border-t pt-1"><span>Total tagihan</span><span className="font-mono">{formatIDR(total)}</span></div>
          </div>
          <div className="space-y-1 text-sm rounded-md border p-3 bg-muted/30">
            <div className="flex justify-between"><span className="text-muted-foreground">Revenue (Subtotal − Diskon)</span><span className="font-mono">{formatIDR(subtotal - discount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">HPP (Modal)</span><span className="font-mono">- {formatIDR(totalCogs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fee marketplace</span><span className="font-mono">- {formatIDR(marketplaceFee)}</span></div>
            <div className={`flex justify-between text-base font-semibold border-t pt-1 ${estProfit >= 0 ? "text-success" : "text-destructive"}`}><span>Estimasi profit</span><span className="font-mono">{formatIDR(estProfit)}</span></div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/orders" })}>Batal</Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? "Menyimpan..." : form.id ? "Simpan perubahan" : "Buat pesanan"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function updateItem(setForm: React.Dispatch<React.SetStateAction<OrderInput>>, idx: number, patch: Partial<OrderInput["items"][number]>) {
  setForm((f) => ({
    ...f,
    items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
  }));
}

export const Route = NewRoute;
export { OrderForm, PAGE_EDIT };
