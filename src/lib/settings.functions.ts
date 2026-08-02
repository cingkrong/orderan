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

    const active_couriers = Array.isArray(localConfig.active_couriers)
      ? localConfig.active_couriers
      : Array.isArray((data as any)?.active_couriers)
        ? (data as any).active_couriers
        : ["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana", "tiki"];

    const rawCustom = Array.isArray((data as any)?.custom_couriers) ? (data as any).custom_couriers : [];
    const embeddedDiscountsEntry = rawCustom.find((c: any) => c?.__courier_discounts);
    const courier_discounts = localConfig.courier_discounts ?? embeddedDiscountsEntry?.__courier_discounts ?? {};

    return {
      ...data,
      active_couriers,
      lincah_couriers,
      courier_discounts,
      lincah_api_key: localConfig.lincah_api_key ?? (data as any)?.lincah_api_key ?? embeddedLincah?.lincah_api_key ?? "oYeiIJkYFMctQebMQOZfOJYNbHkUzShD",
      lincah_partner_id: localConfig.lincah_partner_id ?? (data as any)?.lincah_partner_id ?? embeddedLincah?.lincah_partner_id ?? "6a4617ceb8fd8dd8aa41906e",
      lincah_env: localConfig.lincah_env ?? (data as any)?.lincah_env ?? embeddedLincah?.lincah_env ?? "development",
      label_paper_size: localConfig.label_paper_size ?? (data as any)?.label_paper_size ?? embeddedLincah?.label_paper_size ?? "100x150",
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
    });

    // Embed courier_discounts in custom_couriers under __courier_discounts for DB persistence
    const rawCustom = Array.isArray(data.custom_couriers) ? data.custom_couriers : [];
    const customWithDiscounts = (rawCustom as any[]).filter((c) => !c?.__courier_discounts);
    customWithDiscounts.push({ __courier_discounts: data.courier_discounts });

    // 2. Try updating full settings in Supabase (upsert row with id: 1)
    const { error } = await context.supabase
      .from("settings")
      .upsert({ id: 1, ...data, custom_couriers: customWithDiscounts } as any);

    if (!error) return { ok: true };

    console.warn("Full settings update failed, trying without lincah/extra columns:", error.message);

    // 3. Fallback: strip lincah_ columns and label_paper_size and embed them inside custom_couriers JSONB
    const { lincah_api_key, lincah_partner_id, lincah_env, lincah_couriers, label_paper_size, custom_couriers, ...baseData } = data;

    const enrichedCustom = injectLincahIntoCustom(custom_couriers || [], {
      lincah_couriers,
      lincah_api_key,
      lincah_partner_id,
      lincah_env,
      label_paper_size,
    });

    const { error: err2 } = await context.supabase
      .from("settings")
      .upsert({ id: 1, ...baseData, custom_couriers: enrichedCustom } as any);

    if (!err2) return { ok: true };

    console.warn("Fallback settings update also failed:", err2.message);
    throw new Error(err2.message);
  });
