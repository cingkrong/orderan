import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { autoSubmitOrderToLincah } from "./lincah.functions";


const orderStatus = z.enum([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "completed",
  "cancelled",
]);

const itemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  variant_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  variant: z.string().nullable().optional(),
  qty: z.number().int().min(1),
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
  weight_g: z.number().int().min(0),
});

const orderInput = z.object({
  id: z.string().uuid().optional(),
  customer_name: z.string().min(1),
  phone: z.string().min(3),
  full_address: z.string().min(1),
  province: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  destination_city_id: z.string().nullable().optional(),
  destination_subdistrict_id: z.string().nullable().optional(),
  destination_label: z.string().nullable().optional(),
  courier: z.string().nullable().optional(),
  service: z.string().nullable().optional(),
  tracking_number: z.string().nullable().optional(),
  status: orderStatus.default("pending"),
  payment_status: z.enum(["unpaid", "paid", "partial", "refunded"]).default("unpaid"),
  source: z.string().nullable().optional(),
  campaign: z.string().nullable().optional(),
  ref: z.string().nullable().optional(),
  shipping_cost: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  marketplace_fee: z.number().min(0).default(0),
  eta: z.string().nullable().optional(),
  insurance: z.boolean().default(false),
  routing_code: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  is_dropship: z.boolean().default(false),
  dropship_name: z.string().nullable().optional(),
  dropship_phone: z.string().nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
  recipient_name: z.string().nullable().optional(),
  recipient_phone: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1),
});

export type OrderInput = z.infer<typeof orderInput>;

export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().default(""),
        status: orderStatus.nullable().optional(),
        source: z.string().nullable().optional(),
        courier: z.string().nullable().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.source) q = q.eq("source", data.source);
    if (data.courier) q = q.eq("courier", data.courier);
    if (data.search) {
      const s = data.search.trim();
      q = q.or(
        `order_number.ilike.%${s}%,customer_name.ilike.%${s}%,phone.ilike.%${s}%,tracking_number.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    const { data: items, error: ierr } = await context.supabase
      .from("order_items")
      .select("*")
      .eq("order_id", data.id)
      .order("created_at");
    if (ierr) throw new Error(ierr.message);
    return { order, items: items ?? [] };
  });

export const getOrdersByIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: orders, error } = await context.supabase
      .from("orders")
      .select("*")
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    const { data: items, error: ierr } = await context.supabase
      .from("order_items")
      .select("*")
      .in("order_id", data.ids);
    if (ierr) throw new Error(ierr.message);
    return { orders: orders ?? [], items: items ?? [] };
  });

async function ensureCustomer(
  supabase: { from: (t: string) => any },
  payload: {
    name: string;
    phone: string;
    full_address?: string;
    destination_subdistrict_id?: string;
    destination_label?: string;
    city?: string;
    province?: string;
    district?: string;
    postal_code?: string;
    tags?: string[];
    spent?: number;
    isNewOrder?: boolean;
  },
): Promise<string | null> {
  const phone = (payload.phone || "").trim();
  if (!phone) return null;

  const lastAddress = payload.full_address
    ? {
        full_address: payload.full_address || "",
        destination_subdistrict_id: payload.destination_subdistrict_id || "",
        destination_label: payload.destination_label || "",
        city: payload.city || "",
        province: payload.province || "",
        district: payload.district || "",
        postal_code: payload.postal_code || "",
      }
    : undefined;

  const { data: existing } = await supabase
    .from("customers")
    .select("id, total_orders, total_spent, tags, last_address")
    .eq("phone", phone)
    .maybeSingle();

  const newTags = payload.tags || [];

  if (existing?.id) {
    const existingTags: string[] = Array.isArray(existing.tags) ? existing.tags : [];
    const mergedTags = Array.from(new Set([...existingTags, ...newTags]));

    const updatePayload: Record<string, any> = {
      name: payload.name || undefined,
      last_order_at: new Date().toISOString(),
      tags: mergedTags,
    };
    if (lastAddress) {
      updatePayload.last_address = lastAddress;
    }
    if (payload.isNewOrder) {
      updatePayload.total_orders = (existing.total_orders || 0) + 1;
      updatePayload.total_spent = (existing.total_spent || 0) + (payload.spent || 0);
    }

    await supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", existing.id);

    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      name: payload.name || "Customer",
      phone: phone,
      last_address: lastAddress || null,
      last_order_at: new Date().toISOString(),
      total_orders: payload.isNewOrder !== false ? 1 : 0,
      total_spent: payload.spent || 0,
      tags: newTags,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Failed to create customer:", error.message);
    return null;
  }
  return created?.id ?? null;
}

export const saveOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { items, id, ...orderRest } = data;

    // Validate stock for all items
    for (const it of items) {
      if (it.variant_id) {
        const { data: v } = await context.supabase
          .from("product_variants")
          .select("id, stock, product_id, label, products(name, product_type)")
          .eq("id", it.variant_id)
          .maybeSingle();

        if (v) {
          const productType = (v as any).products?.product_type;
          const isPreorder = productType === "preorder";
          const currentStock = Number(v.stock ?? 0);
          if (!isPreorder && it.qty > currentStock) {
            const variantName = it.variant || v.label || "";
            throw new Error(
              `Jumlah pesanan "${it.name}${variantName ? ` (${variantName})` : ""}" (${it.qty}) melebihi stok yang tersedia (${currentStock})`,
            );
          }
        }
      }
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const weight_g = items.reduce((s, i) => s + i.weight_g * i.qty, 0);
    const total = subtotal + (orderRest.shipping_cost ?? 0);
    const isNewOrder = !id;

    // 1. Save/update primary customer
    const customer_id = await ensureCustomer(context.supabase as any, {
      name: orderRest.customer_name,
      phone: orderRest.phone,
      full_address: orderRest.full_address,
      destination_subdistrict_id: orderRest.destination_subdistrict_id,
      destination_label: orderRest.destination_label,
      city: orderRest.city,
      province: orderRest.province,
      district: orderRest.district,
      postal_code: orderRest.postal_code,
      spent: total,
      isNewOrder,
    });

    // 2. Save/update recipient if phone is different
    if (orderRest.recipient_phone && orderRest.recipient_phone.trim() !== orderRest.phone.trim()) {
      await ensureCustomer(context.supabase as any, {
        name: orderRest.recipient_name || orderRest.customer_name,
        phone: orderRest.recipient_phone,
        full_address: orderRest.full_address,
        destination_subdistrict_id: orderRest.destination_subdistrict_id,
        destination_label: orderRest.destination_label,
        city: orderRest.city,
        province: orderRest.province,
        district: orderRest.district,
        postal_code: orderRest.postal_code,
        tags: ["Penerima"],
        spent: 0,
        isNewOrder,
      });
    }

    // 3. Save/update dropshipper if order is dropship
    if (orderRest.is_dropship && orderRest.dropship_phone && orderRest.dropship_name) {
      await ensureCustomer(context.supabase as any, {
        name: orderRest.dropship_name,
        phone: orderRest.dropship_phone,
        tags: ["Dropshipper"],
        spent: total,
        isNewOrder,
      });
    }

    const orderPayload = {
      ...orderRest,
      subtotal,
      weight_g,
      total,
      customer_id,
      created_by: context.userId,
    };

    let orderId = id;
    if (id) {
      const { error } = await context.supabase.from("orders").update(orderPayload).eq("id", id);
      if (error) throw new Error(error.message);
      await context.supabase.from("order_items").delete().eq("order_id", id);
    } else {
      const { data: inserted, error } = await context.supabase
        .from("orders")
        .insert(orderPayload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      orderId = inserted.id;
    }

    const itemRows = items.map((it) => ({
      order_id: orderId!,
      product_id: it.product_id ?? null,
      variant_id: it.variant_id ?? null,
      name: it.name,
      variant: it.variant ?? null,
      qty: it.qty,
      price: it.price,
      cost: it.cost ?? 0,
      weight_g: it.weight_g,
    }));
    const { error: ierr } = await context.supabase.from("order_items").insert(itemRows);
    if (ierr) throw new Error(ierr.message);

    // Auto submit order to Lincah.id system
    try {
      await autoSubmitOrderToLincah(context.supabase as any, orderId!);
    } catch (lincahErr) {
      console.warn("Auto Lincah order submit failed:", lincahErr);
    }

    return { id: orderId! };
  });


export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1), status: orderStatus }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        tracking_number: z.string().min(1),
        courier: z.string().nullable().optional(),
        markShipped: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({
        tracking_number: data.tracking_number,
        ...(data.courier ? { courier: data.courier } : {}),
        ...(data.markShipped ? { status: "shipped" as const } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markLabelPrinted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error: fErr } = await context.supabase
      .from("orders")
      .select("id, label_print_count")
      .in("id", data.ids);
    if (fErr) throw new Error(fErr.message);
    const now = new Date().toISOString();
    await Promise.all(
      (rows ?? []).map((r: { id: string; label_print_count: number | null }) =>
        context.supabase
          .from("orders")
          .update({
            label_print_count: (r.label_print_count ?? 0) + 1,
            label_printed_at: now,
          })
          .eq("id", r.id),
      ),
    );
    return { ok: true };
  });

// ---------- Dashboard ----------
export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: rows, error } = await context.supabase
      .from("orders")
      .select("id, order_number, status, total, source, created_at, customer_name")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const all = rows ?? [];
    const today = all.filter((o) => new Date(o.created_at) >= todayStart);
    const counts: Record<string, number> = {};
    for (const o of today) counts[o.status] = (counts[o.status] ?? 0) + 1;
    const revenueToday = today
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total ?? 0), 0);

    const bySource: Record<string, number> = {};
    for (const o of all) {
      const k = o.source || "Unknown";
      bySource[k] = (bySource[k] ?? 0) + 1;
    }

    return {
      todayCount: today.length,
      pending: counts.pending ?? 0,
      processing: (counts.confirmed ?? 0) + (counts.processing ?? 0),
      shipped: counts.shipped ?? 0,
      completed: counts.completed ?? 0,
      revenueToday,
      bySource: Object.entries(bySource).map(([source, count]) => ({ source, count })),
      recent: all.slice(0, 8),
    };
  });
