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
    eta: "",
    insurance: false,
    routing_code: "",
    note: "",
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
        courier: order.courier ?? "jne",
        service: order.service ?? "",
        tracking_number: order.tracking_number ?? "",
        status: order.status,
        source: order.source ?? "",
        campaign: order.campaign ?? "",
        ref: order.ref ?? "",
        shipping_cost: Number(order.shipping_cost ?? 0),
        eta: order.eta ?? "",
        insurance: order.insurance,
        routing_code: order.routing_code ?? "",
        note: order.note ?? "",
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          variant: i.variant,
          qty: i.qty,
          price: Number(i.price),
          weight_g: i.weight_g,
        })),
      });
    }
  }, [existingQ.data]);

  const subtotal = useMemo(() => form.items.reduce((s, i) => s + i.price * i.qty, 0), [form.items]);
  const weight = useMemo(() => form.items.reduce((s, i) => s + i.weight_g * i.qty, 0), [form.items]);
  const total = subtotal + (Number(form.shipping_cost) || 0);

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
        }));
        toast.info(`Loaded ${c.name} from previous orders`);
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
    if (!form.destination_city_id) return toast.error("Pick destination city first");
    if (!weight) return toast.error("Add products first");
    if (!form.courier) return toast.error("Pick a courier");
    setLoadingCost(true);
    try {
      const r = await fetchCost({
        data: {
          destination_city_id: form.destination_city_id,
          weight_g: weight,
          courier: form.courier,
        },
      });
      setServices(r.services);
      if (r.services.length === 0) toast.warning("No services available");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoadingCost(false);
    }
  }

  const mut = useMutation({
    mutationFn: (payload: OrderInput) => save({ data: payload }),
    onSuccess: ({ id }) => {
      toast.success(form.id ? "Order updated" : "Order created");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      navigate({ to: "/orders/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function submit() {
    if (form.items.length === 0) return toast.error("Add at least one product");
    const parsed = z.string().min(3).safeParse(form.customer_name);
    if (!parsed.success) return toast.error("Customer name required");
    mut.mutate({ ...form, shipping_cost: Number(form.shipping_cost) || 0 });
  }

  function addItem(productId?: string) {
    const p = productsQ.data?.find((x) => x.id === productId);
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          product_id: p?.id ?? null,
          name: p?.name ?? "",
          variant: p?.variant ?? "",
          qty: 1,
          price: p ? Number(p.price) : 0,
          weight_g: p?.weight_g ?? 0,
        },
      ],
    }));
  }

  if (existingId && existingQ.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {form.id ? `Edit ${form.id ? "order" : ""}` : "New order"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Fast entry — phone autofills, courier auto-calculates.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <h2 className="font-semibold">Customer</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={(e) => tryAutofill(e.target.value)}
                placeholder="0812..."
              />
            </div>
            <div>
              <Label>Customer name</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Full address</Label>
            <Textarea
              rows={2}
              value={form.full_address}
              onChange={(e) => setForm({ ...form, full_address: e.target.value })}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>City (search RajaOngkir)</Label>
              {form.destination_city_id ? (
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{form.city}</div>
                    {form.province && (
                      <div className="text-xs text-muted-foreground">{form.province}</div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setForm((f) => ({ ...f, destination_city_id: "", city: "", province: "" }))
                    }
                  >
                    Ganti
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Input
                    placeholder="Search city…"
                    value={cityQ}
                    onChange={(e) => setCityQ(e.target.value)}
                    className="rounded-none border-0 border-b focus-visible:ring-0"
                  />
                  <div className="max-h-64 overflow-auto">
                    {(citiesQuery.data ?? []).map((c) => (
                      <button
                        key={c.city_id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            destination_city_id: c.city_id,
                            city: `${c.type} ${c.city_name}`,
                            province: c.province,
                            postal_code: f.postal_code || c.postal_code,
                          }))
                        }
                      >
                        <div>{c.type} {c.city_name}</div>
                        <div className="text-xs text-muted-foreground">{c.province} · {c.postal_code}</div>
                      </button>
                    ))}
                    {citiesQuery.data?.length === 0 && (
                      <div className="p-3 text-sm text-muted-foreground">No results — try syncing cities in Settings</div>
                    )}
                    {!citiesQuery.data && (
                      <div className="p-3 text-sm text-muted-foreground">Type to search…</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label>District / Postal code</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input value={form.district ?? ""} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="District" />
                <Input value={form.postal_code ?? ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="Postal" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Order channel</h2>
          <div>
            <Label>Source</Label>
            <Select value={form.source ?? ""} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Campaign</Label>
            <Input value={form.campaign ?? ""} onChange={(e) => setForm({ ...form, campaign: e.target.value })} />
          </div>
          <div>
            <Label>Ref / affiliate</Label>
            <Input value={form.ref ?? ""} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Products</h2>
          <Select onValueChange={addItem}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Add product…" /></SelectTrigger>
            <SelectContent>
              {(productsQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.variant ? ` · ${p.variant}` : ""}</SelectItem>
              ))}
              <SelectItem value="__custom">+ Custom item</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          {form.items.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No items yet</p>}
          {form.items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-4">
                <Label className="text-xs">Name</Label>
                <Input value={it.name} onChange={(e) => updateItem(setForm, idx, { name: e.target.value })} />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Label className="text-xs">Variant</Label>
                <Input value={it.variant ?? ""} onChange={(e) => updateItem(setForm, idx, { variant: e.target.value })} />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min={1} value={it.qty} onChange={(e) => updateItem(setForm, idx, { qty: Number(e.target.value) })} />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Label className="text-xs">Price</Label>
                <Input type="number" value={it.price} onChange={(e) => updateItem(setForm, idx, { price: Number(e.target.value) })} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Label className="text-xs">Weight (g)</Label>
                <Input type="number" value={it.weight_g} onChange={(e) => updateItem(setForm, idx, { weight_g: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => addItem()}><Plus className="size-4 mr-1" />Add custom item</Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Shipping</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <Label>Courier</Label>
            <Select value={form.courier ?? ""} onValueChange={(v) => setForm({ ...form, courier: v, service: "", shipping_cost: 0, eta: "" })}>
              <SelectTrigger><SelectValue placeholder="Courier" /></SelectTrigger>
              <SelectContent>
                {COURIERS.map((c) => <SelectItem key={c} value={c}>{COURIER_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <Button onClick={calcShipping} disabled={loadingCost} className="w-full">
              {loadingCost ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Truck className="size-4 mr-1" />}
              Calculate ({Math.round(weight)}g)
            </Button>
          </div>
          <div>
            <Label>Insurance</Label>
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
                <div className="text-sm">{formatIDR(s.value)} · {s.etd} day</div>
              </button>
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Shipping cost (Rp)</Label>
            <Input type="number" value={form.shipping_cost} onChange={(e) => setForm({ ...form, shipping_cost: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Tracking # (resi)</Label>
            <Input value={form.tracking_number ?? ""} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} />
          </div>
          <div>
            <Label>Routing code</Label>
            <Input value={form.routing_code ?? ""} onChange={(e) => setForm({ ...form, routing_code: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Note</Label>
          <Textarea rows={2} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </Card>

      <Card className="p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1 text-sm">
          <div className="flex gap-6"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatIDR(subtotal)}</span></div>
          <div className="flex gap-6"><span className="text-muted-foreground">Shipping</span><span className="font-mono">{formatIDR(Number(form.shipping_cost) || 0)}</span></div>
          <div className="flex gap-6 text-base font-semibold"><span>Total</span><span className="font-mono">{formatIDR(total)}</span></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/orders" })}>Cancel</Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? "Saving..." : form.id ? "Save changes" : "Create order"}
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
