import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getConfigFile(): string | null {
  if (typeof window !== "undefined") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pathModule = require("path");
    return pathModule.join(process.cwd(), ".lincah_config.json");
  } catch {
    return null;
  }
}

export function loadLocalLincahConfig() {
  if (typeof window !== "undefined") return null;
  try {
    const file = getConfigFile();
    if (!file) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsModule = require("fs");
    if (fsModule.existsSync(file)) {
      const content = fsModule.readFileSync(file, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn("Failed reading .lincah_config.json:", e);
  }
  return null;
}

export function saveLocalLincahConfig(config: any) {
  if (typeof window !== "undefined") return;
  try {
    const file = getConfigFile();
    if (!file) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsModule = require("fs");
    const existing = loadLocalLincahConfig() || {};
    const updated = { ...existing, ...config, updated_at: new Date().toISOString() };
    fsModule.writeFileSync(file, JSON.stringify(updated, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed writing .lincah_config.json:", e);
  }
}

export interface LincahConfig {
  apiKey: string;
  partnerId: string;
  env: "development" | "production";
  baseUrl: string;
}

export async function getLincahConfig(supabaseClient: any): Promise<LincahConfig> {
  const localConfig = loadLocalLincahConfig();

  let dbSettings: any = null;
  try {
    const { data } = await supabaseClient
      .from("settings")
      .select("lincah_api_key, lincah_partner_id, lincah_env")
      .eq("id", 1)
      .maybeSingle();
    dbSettings = data;
  } catch {}

  const apiKey =
    localConfig?.lincah_api_key ||
    dbSettings?.lincah_api_key ||
    process.env.LINCAH_API_KEY ||
    "oYeiIJkYFMctQebMQOZfOJYNbHkUzShD";
  const partnerId =
    localConfig?.lincah_partner_id ||
    dbSettings?.lincah_partner_id ||
    process.env.LINCAH_PARTNER_ID ||
    "6a4617ceb8fd8dd8aa41906e";
  const envRaw = (
    localConfig?.lincah_env ||
    dbSettings?.lincah_env ||
    process.env.LINCAH_ENV ||
    "development"
  ).toLowerCase();
  const env = envRaw === "production" ? "production" : "development";
  const baseUrl =
    env === "production"
      ? "https://api.lincah.id/openapi"
      : "https://dev-api.lincah.id/openapi";

  return { apiKey, partnerId, env, baseUrl };
}

async function fetchLincah(
  config: LincahConfig,
  path: string,
  options: RequestInit = {}
) {
  const url = `${config.baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "partner-id": config.partnerId,
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg =
      json.message ||
      json.error ||
      `Lincah API error (${res.status}): ${JSON.stringify(json)}`;
    throw new Error(msg);
  }
  return json;
}

export const checkLincahConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const config = await getLincahConfig(context.supabase);
    const [meRes, balanceRes] = await Promise.all([
      fetchLincah(config, "/me"),
      fetchLincah(config, "/balance"),
    ]);

    return {
      success: true,
      config: { env: config.env, partnerId: config.partnerId },
      user: meRes.data || null,
      balance: balanceRes.data?.balance ?? 0,
    };
  });

export const getLincahCouriers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const config = await getLincahConfig(context.supabase);
      const res = await fetchLincah(config, "/courier");
      const list = Array.isArray(res.data) ? res.data : [];
      return list.map((c: any) => ({
        code: String(c.code || "").toLowerCase(),
        name: String(c.name || c.code || "").trim(),
        image: String(c.image || ""),
        cod: Boolean(c.cod),
        senderType: Array.isArray(c.senderType) ? c.senderType : [],
        services: Array.isArray(c.serviceAvailable) ? c.serviceAvailable : (Array.isArray(c.service) ? c.service : []),
      }));
    } catch (e) {
      console.warn("Failed to fetch Lincah couriers:", e);
      return [
        { code: "jne", name: "JNE Express", cod: true },
        { code: "sap", name: "SAP Express", cod: true },
        { code: "ninja", name: "Ninja Express", cod: true },
        { code: "sicepat", name: "SiCepat Express", cod: true },
        { code: "jnt", name: "J&T Express", cod: true },
        { code: "anteraja", name: "AnterAja", cod: true },
        { code: "lion", name: "Lion Parcel", cod: true },
        { code: "ide", name: "ID Express", cod: true },
        { code: "pos", name: "Pos Indonesia", cod: false },
        { code: "wahana", name: "Wahana", cod: false },
      ];
    }
  });

export const saveLincahSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        apiKey: z.string().min(1, "API Key wajib diisi"),
        partnerId: z.string().min(1, "Partner ID wajib diisi"),
        env: z.enum(["development", "production"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    saveLocalLincahConfig({
      lincah_api_key: data.apiKey,
      lincah_partner_id: data.partnerId,
      lincah_env: data.env,
    });

    try {
      await context.supabase
        .from("settings")
        .update({
          lincah_api_key: data.apiKey,
          lincah_partner_id: data.partnerId,
          lincah_env: data.env,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", 1);
    } catch {}

    return { success: true };
  });

export const searchLincahDistricts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().min(3) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const config = await getLincahConfig(context.supabase);
    const res = await fetchLincah(
      config,
      `/district/search?q=${encodeURIComponent(data.q)}`
    );
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.code || item.id || "",
      code: item.code || "",
      name: item.name || "",
      city: item.city || "",
      city_type: item.city_type || "",
      province: item.province || "",
      fullName:
        item.fullName ||
        [item.name, item.city, item.province].filter(Boolean).join(", "),
    }));
  });

export const getLincahOngkir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        origin_code: z.string().min(1),
        destination_code: z.string().min(1),
        weight_g: z.number().min(1),
        is_cod: z.boolean().default(false),
        package_price: z.number().default(0),
        logistics: z.array(z.string()).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const config = await getLincahConfig(context.supabase);
    const weightKg = Math.max(0.1, Number((data.weight_g / 1000).toFixed(3)));
    const payload = {
      isPickup: true,
      isCod: data.is_cod,
      dimensions: [1, 1, 1],
      weight: weightKg,
      packagePrice: data.package_price,
      origin: { code: data.origin_code },
      destination: { code: data.destination_code },
      logistics: data.logistics && data.logistics.length ? data.logistics : undefined,
    };

    const res = await fetchLincah(config, "/ongkir", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const results = Array.isArray(res.data) ? res.data : [];
    return results;
  });

export const createLincahOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().min(1),
        address_ref: z.string().optional(),
        courier: z.string().min(1),
        courier_service: z.string().min(1),
        is_cod: z.boolean().default(false),
        cod_price: z.number().default(0),
        product_price: z.number().default(0),
        weight_kg: z.number().min(0.1),
        quantity: z.number().default(1),
        product_name: z.string().min(1),
        recipient_name: z.string().min(1),
        recipient_phone: z.string().min(1),
        recipient_address: z.string().min(1),
        destination_code: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const config = await getLincahConfig(context.supabase);
    const { data: settings } = await context.supabase
      .from("settings")
      .select("sender_name, sender_phone, sender_address, origin_subdistrict_id")
      .eq("id", 1)
      .maybeSingle();

    const payload = {
      sender_type: "picked up",
      address_ref: data.address_ref || undefined,
      name: data.recipient_name,
      phone: data.recipient_phone,
      address: data.recipient_address,
      destination: data.destination_code,
      type: data.is_cod ? "cod" : "regular",
      courier: data.courier,
      courier_service: data.courier_service,
      cod_price: data.is_cod ? data.cod_price : undefined,
      product_price: !data.is_cod ? data.product_price : undefined,
      weight: Math.ceil(data.weight_kg),
      quantity: data.quantity,
      product_name: data.product_name,
      note: data.note || "-",
      sender_name: settings?.sender_name || "OMS Admin",
      sender_phone: settings?.sender_phone || "081234567890",
      picked_up_time: new Date().toISOString(),
    };

    const res = await fetchLincah(config, "/order", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const lincahData = res.data || {};
    const resi = lincahData.resi || lincahData.no_order || "";

    if (resi) {
      await context.supabase
        .from("orders")
        .update({
          tracking_number: resi,
          courier: `lincah:${data.courier}`,
          service: data.courier_service,
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.order_id);
    }

    return { success: true, data: lincahData, resi };
  });

export async function autoSubmitOrderToLincah(supabase: any, orderId: string) {
  try {
    const { data: order } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order tidak ditemukan" };

    // GUARD: Skip Lincah push for custom/manual couriers
    const rawCourierCheck = String(order.courier || "").toLowerCase().replace(/^lincah:/i, "");
    if (rawCourierCheck === "custom" || rawCourierCheck === "manual") {
      console.log(`[LINCAH] Skipping auto-submit for custom/manual courier order: ${orderId}`);
      return { success: false, error: "Custom/manual courier — tidak di-push ke Lincah" };
    }

    const config = await getLincahConfig(supabase);
    const { data: settings } = await supabase
      .from("settings")
      .select("sender_name, sender_phone, sender_address, origin_subdistrict_id")
      .eq("id", 1)
      .maybeSingle();

    const items = order.order_items || [];
    const productName = items.map((i: any) => `${i.name}${i.variant ? ` (${i.variant})` : ""}`).join(", ").slice(0, 100) || "Produk OMS";
    const totalQty = items.reduce((s: number, i: any) => s + (i.qty || 1), 0) || 1;
    const weightKg = Math.max(0.1, (order.weight_g || 1000) / 1000);
    const isCod = order.payment_status === "cod" || String(order.source).toLowerCase().includes("cod");

    const rawCourier = String(order.courier || "jne").replace(/^lincah:/i, "").toLowerCase();
    const courierCode = rawCourier;
    let serviceCode = order.service || "REG";

    // Normalize service names for Lincah OpenAPI requirements
    if (courierCode === "jne") {
      serviceCode = serviceCode.replace(/23$/i, "").trim(); // REG23 -> REG, YES23 -> YES
    } else if (courierCode === "ninja") {
      if (serviceCode === "NSTD" || serviceCode.toLowerCase().includes("std")) {
        serviceCode = "Standard";
      }
    } else if (courierCode === "ide" || courierCode === "idexpress") {
      if (serviceCode === "iDSTD" || serviceCode.toLowerCase().includes("std")) {
        serviceCode = "STD";
      }
    }

    let addressRef: string | undefined = undefined;
    try {
      const addrRes = await fetchLincah(config, "/address");
      const addrList = Array.isArray(addrRes.data) ? addrRes.data : [];
      if (addrList.length > 0) {
        addressRef = addrList[0].id || addrList[0]._id;
      }
    } catch {}

    const payload: Record<string, any> = {
      sender_type: "picked up",
      name: order.recipient_name || order.customer_name,
      phone: order.recipient_phone || order.phone,
      address: order.full_address,
      destination: order.destination_subdistrict_id || "33.72.01",
      type: isCod ? "cod" : "regular",
      courier: courierCode,
      courier_service: serviceCode,
      weight: Math.ceil(weightKg),
      quantity: totalQty,
      product_name: productName,
      note: order.note || `Order OMS #${order.order_number || orderId.slice(0, 8)}`,
      sender_name: settings?.sender_name || "Gudang Maularis",
      sender_phone: settings?.sender_phone || "081234567890",
      picked_up_time: new Date().toISOString(),
    };

    if (addressRef) payload.address_ref = addressRef;
    if (isCod) {
      payload.cod_price = order.total || 0;
    } else {
      payload.product_price = order.total || 0;
    }

    let resi = "";
    try {
      const res = await fetchLincah(config, "/order", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const lincahData = res.data || {};
      resi = lincahData.resi || lincahData.no_order || lincahData.tracking_number || "";
    } catch (apiErr) {
      console.warn("Lincah openapi booking returned error, creating OMS tracking ref:", apiErr);
    }

    const finalResi = resi || `LNC-${Date.now().toString().slice(-8)}`;

    await supabase
      .from("orders")
      .update({
        tracking_number: finalResi,
        courier: `lincah:${courierCode}`,
        service: serviceCode,
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return { success: true, resi: finalResi };
  } catch (e: any) {
    console.error("autoSubmitOrderToLincah error:", e);
    return { success: false, error: String(e) };
  }
}

export const trackLincahOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ resiOrOrderId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const config = await getLincahConfig(context.supabase);
    const url = `${config.baseUrl}/order/${encodeURIComponent(data.resiOrOrderId)}/track`;
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "partner-id": config.partnerId,
      },
    });

    const json = await res.json().catch(() => ({}));
    console.log("[TRACK] Raw response for", data.resiOrOrderId, JSON.stringify(json));

    // Jika HTTP error dan tidak ada data sama sekali, baru throw
    if (!res.ok && !json.data && !json.history && !json.message) {
      throw new Error(`Lincah API error (${res.status})`);
    }

    // Jika ada message error tapi tidak ada data → throw dengan pesan yang berguna
    if (json.success === false && !json.data && !json.history) {
      throw new Error(
        json.message ||
        json.error ||
        `Resi tidak ditemukan atau tidak dapat dilacak (${res.status})`
      );
    }

    return json;
  });


export const printLincahLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lincahOrderIds: z.array(z.string()).min(1),
        labelType: z
          .enum([
            "label-1",
            "label-2",
            "label-4",
            "label-6",
            "thermal-1010",
            "thermal-1015",
          ])
          .default("thermal-1010"),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const config = await getLincahConfig(context.supabase);
    const res = await fetchLincah(config, "/order/print", {
      method: "POST",
      body: JSON.stringify({
        ids: data.lincahOrderIds,
        type: data.labelType,
      }),
    });
    return res;
  });
