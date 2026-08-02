import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function syncCustomersFromOrdersHandler(supabase: any) {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*");
  if (error) throw new Error(error.message);

  if (!orders || orders.length === 0) return { count: 0 };

  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("*");

  const existingByPhone = new Map<string, any>();
  (existingCustomers || []).forEach((c: any) => {
    if (c.phone) existingByPhone.set(String(c.phone).trim(), c);
  });

  const customerMap = new Map<
    string,
    {
      id?: string;
      phone: string;
      name: string;
      total_orders: number;
      total_spent: number;
      last_address: any;
      tags: Set<string>;
    }
  >();

  for (const o of orders) {
    // 1. Primary customer
    if (o.phone) {
      const phone = String(o.phone).trim();
      const dbCust = existingByPhone.get(phone);
      const entry = customerMap.get(phone) || {
        id: dbCust?.id,
        phone,
        name: o.customer_name || dbCust?.name || "Customer",
        total_orders: 0,
        total_spent: 0,
        last_address: dbCust?.last_address || null,
        tags: new Set<string>(Array.isArray(dbCust?.tags) ? dbCust.tags : []),
      };

      entry.name = o.customer_name || entry.name;
      entry.total_orders += 1;
      entry.total_spent += Number(o.total || 0);

      if (o.full_address) {
        entry.last_address = {
          full_address: o.full_address || "",
          destination_subdistrict_id: o.destination_subdistrict_id || "",
          destination_label: o.destination_label || "",
          city: o.city || "",
          province: o.province || "",
          district: o.district || "",
          postal_code: o.postal_code || "",
        };
      }
      customerMap.set(phone, entry);
    }

    // 2. Recipient (if different)
    if (o.recipient_phone && String(o.recipient_phone).trim() !== String(o.phone || "").trim()) {
      const recPhone = String(o.recipient_phone).trim();
      const dbRec = existingByPhone.get(recPhone);
      const recEntry = customerMap.get(recPhone) || {
        id: dbRec?.id,
        phone: recPhone,
        name: o.recipient_name || o.customer_name || dbRec?.name || "Penerima",
        total_orders: 0,
        total_spent: 0,
        last_address: dbRec?.last_address || null,
        tags: new Set<string>(Array.isArray(dbRec?.tags) ? dbRec.tags : []),
      };
      recEntry.name = o.recipient_name || recEntry.name;
      recEntry.tags.add("Penerima");
      if (o.full_address) {
        recEntry.last_address = {
          full_address: o.full_address || "",
          destination_subdistrict_id: o.destination_subdistrict_id || "",
          destination_label: o.destination_label || "",
          city: o.city || "",
          province: o.province || "",
          district: o.district || "",
          postal_code: o.postal_code || "",
        };
      }
      customerMap.set(recPhone, recEntry);
    }

    // 3. Dropshipper
    if (o.is_dropship && o.dropship_phone && o.dropship_name) {
      const dsPhone = String(o.dropship_phone).trim();
      const dbDs = existingByPhone.get(dsPhone);
      const dsEntry = customerMap.get(dsPhone) || {
        id: dbDs?.id,
        phone: dsPhone,
        name: o.dropship_name || dbDs?.name || "Dropshipper",
        total_orders: 0,
        total_spent: 0,
        last_address: dbDs?.last_address || null,
        tags: new Set<string>(Array.isArray(dbDs?.tags) ? dbDs.tags : []),
      };
      dsEntry.name = o.dropship_name || dsEntry.name;
      dsEntry.total_orders += 1;
      dsEntry.total_spent += Number(o.total || 0);
      dsEntry.tags.add("Dropshipper");
      customerMap.set(dsPhone, dsEntry);
    }
  }

  let synced = 0;
  for (const c of customerMap.values()) {
    const payload = {
      phone: c.phone,
      name: c.name,
      total_orders: c.total_orders,
      total_spent: c.total_spent,
      last_address: c.last_address || null,
      tags: Array.from(c.tags),
      updated_at: new Date().toISOString(),
    };

    if (c.id) {
      const { error: uErr } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", c.id);
      if (!uErr) synced++;
      else console.warn("Update customer error:", uErr.message);
    } else {
      const { error: iErr } = await supabase
        .from("customers")
        .insert(payload);
      if (!iErr) synced++;
      else {
        const { error: uErr } = await supabase
          .from("customers")
          .update(payload)
          .eq("phone", c.phone);
        if (!uErr) synced++;
        else console.warn("Insert customer error:", iErr.message, uErr.message);
      }
    }
  }

  return { count: synced };
}

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let { data, error } = await context.supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      const { data: orders } = await context.supabase.from("orders").select("id").limit(1);
      if (orders && orders.length > 0) {
        await syncCustomersFromOrdersHandler(context.supabase as any);
        const { data: refetched } = await context.supabase
          .from("customers")
          .select("*")
          .order("created_at", { ascending: false });
        data = refetched ?? [];
      }
    }

    return data ?? [];
  });

export const getCustomerByPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .select("*")
      .eq("phone", data.phone)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const searchCustomersByName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const q = data.query.trim();
    if (q.length < 1) return [];
    const { data: rows, error } = await context.supabase
      .from("customers")
      .select("*")
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: customer, error } = await context.supabase
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: orders, error: oerr } = await context.supabase
      .from("orders")
      .select("id, order_number, status, total, created_at, courier, tracking_number")
      .or(`customer_id.eq.${data.id},phone.eq.${customer?.phone || ""},dropship_phone.eq.${customer?.phone || ""}`)
      .order("created_at", { ascending: false });
    if (oerr) throw new Error(oerr.message);
    return { customer, orders: orders ?? [] };
  });

export const updateCustomerTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), tags: z.array(z.string()), notes: z.string().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customers")
      .update({ tags: data.tags, notes: data.notes })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCustomerDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1, "Nama pelanggan wajib diisi"),
        phone: z.string().min(3, "Nomor telepon minimal 3 karakter"),
        tags: z.array(z.string()).default([]),
        notes: z.string().nullable().optional(),
        last_address: z.any().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...updateFields } = data;
    const { error } = await context.supabase
      .from("customers")
      .update(updateFields as any)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const createCustomerSchema = z.object({
  name: z.string().min(1, "Nama pelanggan wajib diisi"),
  phone: z.string().min(3, "Nomor telepon minimal 3 karakter"),
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  last_address: z
    .object({
      full_address: z.string().optional(),
      district: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      postal_code: z.string().optional(),
      destination_subdistrict_id: z.string().optional(),
      destination_label: z.string().optional(),
    })
    .optional(),
});

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createCustomerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const phone = data.phone.trim();
    const { data: existing } = await context.supabase
      .from("customers")
      .select("id, name")
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      throw new Error(`Pelanggan dengan nomor ${phone} sudah ada (${existing.name})`);
    }

    const { data: created, error } = await context.supabase
      .from("customers")
      .insert({
        name: data.name.trim(),
        phone,
        tags: data.tags,
        notes: data.notes || null,
        last_address: data.last_address || null,
        total_orders: 0,
        total_spent: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return created;
  });

export const syncCustomersFromOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return syncCustomersFromOrdersHandler(context.supabase);
  });
