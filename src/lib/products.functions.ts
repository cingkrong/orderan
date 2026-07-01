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
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
  weight_g: z.number().int().min(0),
  stock: z.number().int(),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

const productInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  variant: z.string().nullable().optional(),
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
  weight_g: z.number().int().min(0),
  stock: z.number().int(),
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

    // Upsert current
    const rows = variants.map((v, idx) => ({
      ...(v.id ? { id: v.id } : {}),
      product_id: productId!,
      label: v.label,
      sku: v.sku || null,
      price: v.price,
      cost: v.cost,
      weight_g: v.weight_g,
      stock: v.stock,
      is_default: v.is_default,
      sort_order: v.sort_order ?? idx,
    }));
    const { error: upErr } = await context.supabase
      .from("product_variants")
      .upsert(rows);
    if (upErr) throw new Error(upErr.message);

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
