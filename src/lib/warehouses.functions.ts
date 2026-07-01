import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const warehouseInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  sender_name: z.string().nullable().optional(),
  sender_phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  origin_subdistrict_id: z.string().nullable().optional(),
  origin_label: z.string().nullable().optional(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
export type WarehouseInput = z.infer<typeof warehouseInput>;

export const listWarehouses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("warehouses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => warehouseInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.is_default) {
      await context.supabase.from("warehouses").update({ is_default: false }).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("warehouses").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: inserted, error } = await context.supabase
      .from("warehouses")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deleteWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("warehouses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
