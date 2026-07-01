import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listStockMovements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        product_id: z.string().uuid().nullable().optional(),
        variant_id: z.string().uuid().nullable().optional(),
        order_id: z.string().uuid().nullable().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("stock_movements")
      .select("*, product:products(name), variant:product_variants(label, color, size)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.product_id) q = q.eq("product_id", data.product_id);
    if (data.variant_id) q = q.eq("variant_id", data.variant_id);
    if (data.order_id) q = q.eq("order_id", data.order_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adjustStockManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        variant_id: z.string().uuid(),
        delta: z.number().int().refine((n) => n !== 0, "delta tidak boleh 0"),
        note: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("adjust_variant_stock", {
      _variant_id: data.variant_id,
      _delta: data.delta,
      _reason: "manual",
      _order_id: null,
      _note: data.note ?? "",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOrderHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("order_history")
      .select("*, actor:profiles(full_name)")
      .eq("order_id", data.order_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
