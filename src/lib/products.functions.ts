import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Products ----------
export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("*, variants:product_variants(*)")
      .order("name");
    if (error) throw new Error(error.message);
    // Sort variants by sort_order then label
    return (data ?? []).map((p: any) => ({
      ...p,
      variants: (p.variants ?? []).sort(
        (a: any, b: any) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label),
      ),
    }));
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("products")
      .select("*, variants:product_variants(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Product not found");
    const variants = ((row as any).variants ?? []).sort(
      (a: any, b: any) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label),
    );
    return { ...row, variants };
  });

const variantInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  sku: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
  dropship_price: z.number().min(0).default(0),
  weight_g: z.number().int().min(0),
  stock: z.number().int(),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  image_url: z.string().nullable().optional(),
});

const wholesaleTier = z.object({
  min_qty: z.number().int().min(1),
  price: z.number().min(0),
});

const productInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  product_type: z.enum(["stock", "preorder"]).default("stock"),
  sku: z.string().nullable().optional(),
  variant: z.string().nullable().optional(),
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
  weight_g: z.number().int().min(0),
  stock: z.number().int(),
  wholesale_enabled: z.boolean().default(false),
  wholesale_tiers: z.array(wholesaleTier).default([]),
  discount_type: z.string().nullable().optional(),
  discount_value: z.number().nullable().optional(),
  storefront_visible: z.boolean().default(false),
  show_stock: z.boolean().default(false),
  variants: z.array(variantInput).min(1),
});


export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, variants, ...rest } = data;

    // Denormalize aggregates onto products for backward-compat display / fallback.
    const defaultVariant = variants.find((v) => v.is_default) ?? variants[0];
    const totalStock = variants.reduce((s, v) => s + (v.stock || 0), 0);
    const productPayload = {
      ...rest,
      sku: rest.sku || defaultVariant.sku || null,
      variant: variants.length > 1 ? `${variants.length} variasi` : defaultVariant.label,
      price: defaultVariant.price,
      cost: defaultVariant.cost,
      weight_g: defaultVariant.weight_g,
      stock: totalStock,
    };

    let productId = id;
    if (id) {
      const { error } = await context.supabase
        .from("products")
        .update(productPayload)
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await context.supabase
        .from("products")
        .insert(productPayload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      productId = inserted.id;
    }

    // Load existing variants to compute diff
    const { data: existing, error: exErr } = await context.supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId!);
    if (exErr) throw new Error(exErr.message);

    const existingIds = new Set((existing ?? []).map((v: any) => v.id));
    const submittedIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));

    // Delete removed
    const toDelete = [...existingIds].filter((eid) => !submittedIds.has(eid));
    if (toDelete.length > 0) {
      const { error } = await context.supabase
        .from("product_variants")
        .delete()
        .in("id", toDelete);
      if (error) throw new Error(error.message);
    }

    // Split into inserts (no id → let DB generate) vs updates (has id).
    // NOTE: mixing rows with/without id in a single .upsert() causes PostgREST
    // to send `id: null` for rows lacking the key, overriding the DB default
    // gen_random_uuid() and violating the NOT NULL constraint.
    const commonRow = (v: any, idx: number) => ({
      product_id: productId!,
      label: v.label,
      sku: v.sku || null,
      color: v.color || null,
      size: v.size || null,
      price: v.price,
      cost: v.cost,
      dropship_price: v.dropship_price ?? 0,
      weight_g: v.weight_g,
      stock: v.stock,
      is_default: v.is_default,
      sort_order: v.sort_order ?? idx,
      image_url: v.image_url || null,
    });

    const toInsert = variants
      .map((v, idx) => ({ v, idx }))
      .filter(({ v }) => !v.id)
      .map(({ v, idx }) => commonRow(v, idx));

    const toUpdate = variants
      .map((v, idx) => ({ v, idx }))
      .filter(({ v }) => !!v.id)
      .map(({ v, idx }) => ({ id: v.id!, ...commonRow(v, idx) }));

    if (toInsert.length > 0) {
      const { error } = await context.supabase.from("product_variants").insert(toInsert);
      if (error) throw new Error(error.message);
    }
    if (toUpdate.length > 0) {
      const { error } = await context.supabase.from("product_variants").upsert(toUpdate);
      if (error) throw new Error(error.message);
    }


    return { ok: true, id: productId };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
