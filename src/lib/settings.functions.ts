import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { saveLocalLincahConfig, loadLocalLincahConfig } from "./lincah.functions";

/** Helper: extract lincah config stored inside custom_couriers JSONB as __lincah key */
function extractLincahFromCustom(customCouriers: any): Record<string, any> | null {
  if (Array.isArray(customCouriers)) {
    const entry = customCouriers.find((c: any) => c?.__lincah);
    return entry?.__lincah ?? null;
  }
  return null;
}

/** Helper: inject lincah config into custom_couriers JSONB array under __lincah key */
function injectLincahIntoCustom(
  customCouriers: any[],
  lincahData: { lincah_couriers?: string[]; lincah_api_key?: string; lincah_partner_id?: string; lincah_env?: string; label_paper_size?: string },
): any[] {
  const filtered = (customCouriers || []).filter((c: any) => !c?.__lincah);
  return [...filtered, { __lincah: lincahData }];
}

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const localConfig = loadLocalLincahConfig() || {};
    const embeddedLincah = extractLincahFromCustom((data as any)?.custom_couriers);

    const lincah_couriers = Array.isArray(localConfig.lincah_couriers)
      ? localConfig.lincah_couriers
      : Array.isArray((data as any)?.lincah_couriers)
        ? (data as any).lincah_couriers
        : Array.isArray(embeddedLincah?.lincah_couriers)
          ? embeddedLincah.lincah_couriers
          : ["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana"];

    const jne_flat_ongkir_enabled =
      localConfig.jne_flat_ongkir_enabled ??
      (data as any)?.jne_flat_ongkir_enabled ??
      embeddedLincah?.jne_flat_ongkir_enabled ??
      false;

    const jne_flat_zone_ab_price =
      localConfig.jne_flat_zone_ab_price ??
      (data as any)?.jne_flat_zone_ab_price ??
      embeddedLincah?.jne_flat_zone_ab_price ??
      9000;

    const jne_flat_zone_cd_price =
      localConfig.jne_flat_zone_cd_price ??
      (data as any)?.jne_flat_zone_cd_price ??
      embeddedLincah?.jne_flat_zone_cd_price ??
      11000;

    const active_couriers = Array.isArray(localConfig.active_couriers)
      ? localConfig.active_couriers
      : Array.isArray((data as any)?.active_couriers)
        ? (data as any).active_couriers
        : ["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana", "tiki"];

    const rawCustom = Array.isArray((data as any)?.custom_couriers) ? (data as any).custom_couriers : [];
    const embeddedDiscountsEntry = rawCustom.find((c: any) => c?.__courier_discounts);
    const courier_discounts = localConfig.courier_discounts ?? embeddedDiscountsEntry?.__courier_discounts ?? {};

    const invoice_prefix = localConfig.invoice_prefix ?? (data as any)?.invoice_prefix ?? embeddedLincah?.invoice_prefix ?? "#";
    const invoice_digit_length = localConfig.invoice_digit_length ?? (data as any)?.invoice_digit_length ?? embeddedLincah?.invoice_digit_length ?? 4;
    const invoice_include_date = (data as any)?.invoice_include_date ?? embeddedLincah?.invoice_include_date ?? localConfig.invoice_include_date ?? "none";

    const lincah_api_key =
      (data as any)?.lincah_api_key ||
      embeddedLincah?.lincah_api_key ||
      localConfig.lincah_api_key ||
      "oYeiIJkYFMctQebMQOZfOJYNbHkUzShD";

    const lincah_partner_id =
      (data as any)?.lincah_partner_id ||
      embeddedLincah?.lincah_partner_id ||
      localConfig.lincah_partner_id ||
      "6a4617ceb8fd8dd8aa41906e";

    const lincah_env =
      (data as any)?.lincah_env ||
      embeddedLincah?.lincah_env ||
      localConfig.lincah_env ||
      "development";

    return {
      ...data,
      active_couriers,
      lincah_couriers,
      courier_discounts,
      jne_flat_ongkir_enabled,
      jne_flat_zone_ab_price,
      jne_flat_zone_cd_price,
      invoice_prefix,
      invoice_digit_length,
      invoice_include_date,
      lincah_api_key,
      lincah_partner_id,
      lincah_env,
      label_paper_size: (data as any)?.label_paper_size ?? embeddedLincah?.label_paper_size ?? localConfig.label_paper_size ?? "100x150",
      weight_unit: (data as any)?.weight_unit === "kg" ? "kg" : "g",
    };
  });

const customCourierSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  description: z.string().optional().default(""),
  etd: z.string().optional().default("-"),
});

const courierDiscountSchema = z.object({
  cod_discount: z.number().min(0).max(100).optional(),
  non_cod_discount: z.number().min(0).max(100).optional(),
});

const settingsSchema = z.object({
  sender_name: z.string(),
  sender_phone: z.string(),
  sender_city: z.string(),
  sender_address: z.string(),
  origin_subdistrict_id: z.string(),
  origin_label: z.string(),
  logo_url: z.string().nullable(),
  active_couriers: z.array(z.string()).default([]),
  custom_couriers: z.array(customCourierSchema).default([]),
  courier_discounts: z.record(z.string(), courierDiscountSchema).optional().default({}),
  weight_unit: z.enum(["g", "kg"]).default("g"),
  lincah_api_key: z.string().optional().default("oYeiIJkYFMctQebMQOZfOJYNbHkUzShD"),
  lincah_partner_id: z.string().optional().default("6a4617ceb8fd8dd8aa41906e"),
  lincah_env: z.enum(["development", "production"]).optional().default("development"),
  lincah_couriers: z.array(z.string()).optional().default(["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana"]),
  label_paper_size: z.enum(["100x100", "100x150"]).optional().default("100x150"),
  jne_flat_ongkir_enabled: z.boolean().optional().default(false),
  jne_flat_zone_ab_price: z.number().min(0).optional().default(9000),
  jne_flat_zone_cd_price: z.number().min(0).optional().default(11000),
  invoice_prefix: z.string().optional().default("#"),
  invoice_digit_length: z.number().min(2).max(8).optional().default(4),
  invoice_include_date: z.enum(["none", "YYMM", "YYYYMMDD"]).optional().default("none"),
});

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    // 1. Try local config save (works only in Node.js dev, silently no-ops elsewhere)
    saveLocalLincahConfig({
      lincah_api_key: data.lincah_api_key,
      lincah_partner_id: data.lincah_partner_id,
      lincah_env: data.lincah_env,
      lincah_couriers: data.lincah_couriers,
      active_couriers: data.active_couriers,
      label_paper_size: data.label_paper_size,
      courier_discounts: data.courier_discounts,
      jne_flat_ongkir_enabled: data.jne_flat_ongkir_enabled,
      jne_flat_zone_ab_price: data.jne_flat_zone_ab_price,
      jne_flat_zone_cd_price: data.jne_flat_zone_cd_price,
      invoice_prefix: data.invoice_prefix,
      invoice_digit_length: data.invoice_digit_length,
      invoice_include_date: data.invoice_include_date,
    });

    // 2. Prepare payload for Supabase settings table
    const {
      lincah_couriers, label_paper_size,
      courier_discounts, jne_flat_ongkir_enabled, jne_flat_zone_ab_price, jne_flat_zone_cd_price,
      invoice_prefix, invoice_digit_length, invoice_include_date,
      custom_couriers, active_couriers,
      ...supabaseData
    } = data;

    // Build enriched custom_couriers: real custom couriers + embedded config objects
    const realCustom = (custom_couriers || []).filter((c: any) => !c?.__lincah && !c?.__courier_discounts);
    const enrichedCustom = [
      ...realCustom,
      {
        __lincah: {
          lincah_couriers,
          lincah_api_key: data.lincah_api_key,
          lincah_partner_id: data.lincah_partner_id,
          lincah_env: data.lincah_env,
          label_paper_size,
          jne_flat_ongkir_enabled,
          jne_flat_zone_ab_price,
          jne_flat_zone_cd_price,
          invoice_prefix,
          invoice_digit_length,
          invoice_include_date,
        },
      },
      { __courier_discounts: courier_discounts },
    ];

    // Try full upsert (includes lincah_api_key, lincah_partner_id, lincah_env, active_couriers)
    const { error } = await context.supabase
      .from("settings")
      .upsert({
        id: 1,
        ...supabaseData,
        lincah_api_key: data.lincah_api_key,
        lincah_partner_id: data.lincah_partner_id,
        lincah_env: data.lincah_env,
        active_couriers,
        custom_couriers: enrichedCustom,
      } as any);

    if (!error) return { ok: true };

    console.warn("Full settings update failed, trying fallback without lincah columns:", error.message);

    // Fallback: try without direct lincah columns (in case columns don't exist in DB)
    const { lincah_api_key, lincah_partner_id, lincah_env, ...fallbackData } = supabaseData as any;
    const { error: err2 } = await context.supabase
      .from("settings")
      .upsert({ id: 1, ...fallbackData, custom_couriers: enrichedCustom } as any);

    if (!err2) return { ok: true };

    console.warn("Fallback settings update also failed:", err2.message);
    throw new Error(err2.message);
  });

