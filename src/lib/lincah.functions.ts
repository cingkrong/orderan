import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { syncCustomersFromOrdersHandler } from "./customers.functions";
import { recordMiddlewareLog } from "./middleware.functions";

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
      .select("lincah_api_key, lincah_partner_id, lincah_env, custom_couriers")
      .eq("id", 1)
      .maybeSingle();
    dbSettings = data;
  } catch {}

  function extractLincahFromCustom(customCouriers: any): Record<string, any> | null {
    if (Array.isArray(customCouriers)) {
      const entry = customCouriers.find((c: any) => c?.__lincah);
      return entry?.__lincah ?? null;
    }
    return null;
  }
  const embeddedLincah = extractLincahFromCustom(dbSettings?.custom_couriers);

  const apiKey =
    dbSettings?.lincah_api_key ||
    embeddedLincah?.lincah_api_key ||
    localConfig?.lincah_api_key ||
    process.env.LINCAH_API_KEY ||
    "oYeiIJkYFMctQebMQOZfOJYNbHkUzShD";
  const partnerId =
    dbSettings?.lincah_partner_id ||
    embeddedLincah?.lincah_partner_id ||
    localConfig?.lincah_partner_id ||
    process.env.LINCAH_PARTNER_ID ||
    "6a4617ceb8fd8dd8aa41906e";
  const envRaw = String(
    dbSettings?.lincah_env ||
      embeddedLincah?.lincah_env ||
      localConfig?.lincah_env ||
      process.env.LINCAH_ENV ||
      "development",
  ).toLowerCase();
  const env = envRaw === "production" ? "production" : "development";
  const baseUrl =
    env === "production" ? "https://api.lincah.id/openapi" : "https://dev-api.lincah.id/openapi";

  return { apiKey, partnerId, env, baseUrl };
}

async function fetchLincah(config: LincahConfig, path: string, options: RequestInit = {}) {
  const startMs = Date.now();
  const url = `${config.baseUrl}${path}`;
  let reqPayload: any = undefined;
  if (options.body && typeof options.body === "string") {
    try {
      reqPayload = JSON.parse(options.body);
    } catch {
      reqPayload = options.body;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "partner-id": config.partnerId,
        ...(options.headers || {}),
      },
    });
  } catch (networkErr: any) {
    const latencyMs = Date.now() - startMs;
    recordMiddlewareLog({
      service: "lincah",
      endpoint: path,
      method: (options.method || "GET").toUpperCase() as any,
      status: 0,
      latencyMs,
      success: false,
      requestPayload: reqPayload,
      error: networkErr?.message || "Network Error ke server Lincah",
    });
    throw networkErr;
  }

  const latencyMs = Date.now() - startMs;
  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }

  const isSuccess = res.ok && json.success !== false;

  recordMiddlewareLog({
    service: "lincah",
    endpoint: path,
    method: (options.method || "GET").toUpperCase() as any,
    status: res.status,
    latencyMs,
    success: isSuccess,
    requestPayload: reqPayload,
    responsePayload: isSuccess ? json : undefined,
    error: isSuccess ? undefined : json.message || json.error || `HTTP ${res.status}`,
  });

  if (!isSuccess) {
    if (res.status === 401) {
      const modeLabel = config.env === "production" ? "Production (Live)" : "Sandbox (Development)";
      throw new Error(
        `Autentikasi Lincah gagal (HTTP 401) pada server ${modeLabel}. Pastikan Anda memasukkan API Key & Partner ID ${config.env === "production" ? "Production resmi" : "Sandbox"} yang valid.`,
      );
    }
    if (text.includes("<!doctype html>") || text.includes("<html")) {
      throw new Error(
        `Server Lincah (${config.env}) merespon error HTTP ${res.status}. Pastikan Mode Lingkungan (Development / Production) dan API Key di Pengaturan sudah sesuai.`,
      );
    }
    const msg =
      json.message ||
      json.error ||
      `Lincah API error (${res.status}): ${text || "Tidak ada respon"}`;
    throw new Error(msg);
  }
  return json;
}

export const checkLincahConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        apiKey: z.string().optional(),
        partnerId: z.string().optional(),
        env: z.enum(["development", "production"]).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let config = await getLincahConfig(context.supabase);

    if (data?.apiKey && data?.partnerId && data?.env) {
      const env = data.env;
      const baseUrl =
        env === "production"
          ? "https://api.lincah.id/openapi"
          : "https://dev-api.lincah.id/openapi";
      config = {
        apiKey: data.apiKey.trim(),
        partnerId: data.partnerId.trim(),
        env,
        baseUrl,
      };
    }

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
        services: Array.isArray(c.serviceAvailable)
          ? c.serviceAvailable
          : Array.isArray(c.service)
            ? c.service
            : [],
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
      .parse(d),
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
  .inputValidator((d: unknown) => z.object({ q: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const config = await getLincahConfig(context.supabase);
    const res = await fetchLincah(config, `/district/search?q=${encodeURIComponent(data.q)}`);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.code || item.id || "",
      code: item.code || "",
      name: item.name || "",
      city: item.city || "",
      city_type: item.city_type || "",
      province: item.province || "",
      fullName: item.fullName || [item.name, item.city, item.province].filter(Boolean).join(", "),
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
      .parse(d),
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
      .parse(d),
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
    const rawCourierCheck = String(order.courier || "")
      .toLowerCase()
      .replace(/^lincah:/i, "");
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
    const productName =
      items
        .map((i: any) => `${i.name}${i.variant ? ` (${i.variant})` : ""}`)
        .join(", ")
        .slice(0, 100) || "Produk OMS";
    const totalQty = items.reduce((s: number, i: any) => s + (i.qty || 1), 0) || 1;
    const weightKg = Math.max(0.1, (order.weight_g || 1000) / 1000);
    const isCod =
      order.payment_status === "cod" || String(order.source).toLowerCase().includes("cod");

    const rawCourier = String(order.courier || "jne")
      .replace(/^lincah:/i, "")
      .toLowerCase();
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

    const finalResi = resi || `LNCH-${Date.now().toString().slice(-8)}`;

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
  .inputValidator((d: unknown) => z.object({ resiOrOrderId: z.string().min(1) }).parse(d))
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
          `Resi tidak ditemukan atau tidak dapat dilacak (${res.status})`,
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
          .enum(["label-1", "label-2", "label-4", "label-6", "thermal-1010", "thermal-1015"])
          .default("thermal-1010"),
      })
      .parse(d),
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

export const syncCustomersFromLincah = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const config = await getLincahConfig(context.supabase);

    async function fetchAllPages(endpoint: string, maxPages = 50): Promise<any[]> {
      const result: any[] = [];
      let page = 1;
      const limit = 100;
      const delimiter = endpoint.includes("?") ? "&" : "?";

      while (page <= maxPages) {
        try {
          const res = await fetchLincah(
            config,
            `${endpoint}${delimiter}page=${page}&limit=${limit}`,
          );
          let list: any[] = [];
          if (Array.isArray(res.data)) list = res.data;
          else if (Array.isArray(res.data?.items)) list = res.data.items;
          else if (Array.isArray(res.items)) list = res.items;
          else if (Array.isArray(res)) list = res;

          if (list.length === 0) break;
          result.push(...list);

          const total =
            typeof res.total === "number"
              ? res.total
              : typeof res.totalData === "number"
                ? res.totalData
                : 0;
          if (list.length < limit || (total > 0 && result.length >= total)) {
            break;
          }
          page++;
        } catch (e) {
          console.warn(`Failed fetching ${endpoint} page ${page}:`, e);
          break;
        }
      }
      return result;
    }

    const [addressList, orderList] = await Promise.all([
      fetchAllPages("/address"),
      fetchAllPages("/order"),
    ]);

    const { data: existingCustomers } = await context.supabase.from("customers").select("*");

    function normalizePhone(p: string): string {
      let cleaned = String(p || "").replace(/\D/g, "");
      if (cleaned.startsWith("62")) {
        cleaned = "0" + cleaned.slice(2);
      }
      return cleaned;
    }

    const existingByPhone = new Map<string, any>();
    (existingCustomers || []).forEach((c: any) => {
      if (c.phone) existingByPhone.set(normalizePhone(c.phone), c);
    });

    const customerMap = new Map<string, any>();

    // 1. Process Address Book entries from Lincah
    for (const item of addressList) {
      const phoneRaw =
        item.contact?.phone ||
        item.phone ||
        item.recipient_phone ||
        item.receiver_phone ||
        item.recipient?.phone ||
        item.receiver?.phone ||
        item.customer?.phone;
      if (!phoneRaw) continue;
      const phone = normalizePhone(phoneRaw);
      if (!phone || phone.length < 5) continue;

      const name = (
        item.contact?.name ||
        item.recipient_name ||
        item.receiver_name ||
        item.name ||
        item.recipient?.name ||
        item.receiver?.name ||
        "Pelanggan Lincah"
      ).trim();
      const dbCust = existingByPhone.get(phone);

      const districtObj = item.district || item.destination || {};
      const fullAddress = item.address || item.full_address || item.recipient_address || "";
      const districtName =
        typeof districtObj === "object" ? districtObj.district || districtObj.name || "" : "";
      const cityName =
        typeof districtObj === "object" && districtObj.city
          ? `${districtObj.city_type || ""} ${districtObj.city}`.trim()
          : "";
      const provinceName = typeof districtObj === "object" ? districtObj.province || "" : "";
      const destCode =
        typeof districtObj === "object"
          ? districtObj.code || districtObj.id || ""
          : String(districtObj || "");

      const tags = new Set<string>(Array.isArray(dbCust?.tags) ? dbCust.tags : []);
      tags.add("Lincah API");

      const entry = customerMap.get(phone) || {
        id: dbCust?.id,
        phone,
        name: dbCust?.name || name,
        total_orders: dbCust?.total_orders || 0,
        total_spent: dbCust?.total_spent || 0,
        last_address: dbCust?.last_address || null,
        tags,
      };

      if (name && (!entry.name || entry.name === "Pelanggan Lincah")) {
        entry.name = name;
      }

      if (fullAddress || districtName) {
        entry.last_address = {
          full_address: fullAddress || entry.last_address?.full_address || "",
          district: districtName || entry.last_address?.district || "",
          city: cityName || entry.last_address?.city || "",
          province: provinceName || entry.last_address?.province || "",
          destination_subdistrict_id:
            destCode || entry.last_address?.destination_subdistrict_id || "",
          destination_label: [districtName, cityName, provinceName].filter(Boolean).join(", "),
        };
      }

      customerMap.set(phone, entry);
    }

    // 2. Process Order history entries from Lincah
    for (const o of orderList) {
      const phoneRaw =
        o.phone ||
        o.recipient_phone ||
        o.receiver_phone ||
        o.contact?.phone ||
        o.recipient?.phone ||
        o.receiver?.phone ||
        o.customer?.phone ||
        o.customer_phone;
      if (!phoneRaw) continue;
      const phone = normalizePhone(phoneRaw);
      if (!phone || phone.length < 5) continue;

      const name = (
        o.name ||
        o.recipient_name ||
        o.receiver_name ||
        o.contact?.name ||
        o.recipient?.name ||
        o.receiver?.name ||
        o.customer?.name ||
        "Pelanggan Lincah"
      ).trim();
      const dbCust = existingByPhone.get(phone);

      const tags = new Set<string>(Array.isArray(dbCust?.tags) ? dbCust.tags : []);
      tags.add("Lincah API");

      const entry = customerMap.get(phone) || {
        id: dbCust?.id,
        phone,
        name: dbCust?.name || name,
        total_orders: dbCust?.total_orders || 0,
        total_spent: dbCust?.total_spent || 0,
        last_address: dbCust?.last_address || null,
        tags,
      };

      if (name && (!entry.name || entry.name === "Pelanggan Lincah")) {
        entry.name = name;
      }

      const fullAddress = o.address || o.recipient_address || o.full_address || "";
      if (fullAddress) {
        entry.last_address = {
          full_address: fullAddress,
          destination_subdistrict_id:
            typeof o.destination === "string" ? o.destination : o.destination?.code || "",
          destination_label: o.destination_label || "",
        };
      }

      customerMap.set(phone, entry);
    }

    let createdCount = 0;
    let updatedCount = 0;

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
        const { error: uErr } = await context.supabase
          .from("customers")
          .update(payload)
          .eq("id", c.id);
        if (!uErr) updatedCount++;
      } else {
        const { error: iErr } = await context.supabase.from("customers").insert(payload);
        if (!iErr) createdCount++;
        else {
          const { error: uErr } = await context.supabase
            .from("customers")
            .update(payload)
            .eq("phone", c.phone);
          if (!uErr) updatedCount++;
        }
      }
    }

    return {
      success: true,
      totalAddressFetched: addressList.length,
      totalOrdersFetched: orderList.length,
      uniqueCustomersCount: customerMap.size,
      count: createdCount + updatedCount,
      createdCount,
      updatedCount,
    };
  });

export const getLincahAddressBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const config = await getLincahConfig(context.supabase);
    const res = await fetchLincah(config, "/address?page=1&limit=100");
    return Array.isArray(res.data) ? res.data : [];
  });

export const syncOrdersFromLincah = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const config = await getLincahConfig(context.supabase);

    async function fetchAllOrderPages(maxPages = 50): Promise<any[]> {
      const result: any[] = [];
      let page = 1;
      const limit = 100;

      while (page <= maxPages) {
        try {
          const res = await fetchLincah(config, `/order?page=${page}&limit=${limit}`);
          let list: any[] = [];
          if (Array.isArray(res.data)) list = res.data;
          else if (Array.isArray(res.data?.items)) list = res.data.items;
          else if (Array.isArray(res.items)) list = res.items;
          else if (Array.isArray(res)) list = res;

          if (list.length === 0) break;
          result.push(...list);

          const total =
            typeof res.total === "number"
              ? res.total
              : typeof res.totalData === "number"
                ? res.totalData
                : 0;
          if (list.length < limit || (total > 0 && result.length >= total)) {
            break;
          }
          page++;
        } catch (e) {
          console.warn(`Failed fetching /order page ${page}:`, e);
          break;
        }
      }
      return result;
    }

    const orderList = await fetchAllOrderPages();

    if (orderList.length === 0) {
      return { success: true, count: 0, createdCount: 0, updatedCount: 0, totalFetched: 0 };
    }

    function normalizePhone(p: string): string {
      let cleaned = String(p || "").replace(/\D/g, "");
      if (cleaned.startsWith("62")) {
        cleaned = "0" + cleaned.slice(2);
      }
      return cleaned;
    }

    function mapLincahStatus(
      statusStr: string,
    ): "pending" | "confirmed" | "processing" | "shipped" | "completed" | "cancelled" {
      const s = String(statusStr || "").toLowerCase();
      if (
        s.includes("deliver") ||
        s.includes("complete") ||
        s.includes("selesai") ||
        s.includes("sampai")
      )
        return "completed";
      if (
        s.includes("ship") ||
        s.includes("transit") ||
        s.includes("dikirim") ||
        s.includes("jalan")
      )
        return "shipped";
      if (s.includes("cancel") || s.includes("batal") || s.includes("retur")) return "cancelled";
      if (s.includes("process") || s.includes("pick") || s.includes("kemas")) return "processing";
      return "processing";
    }

    // Fetch existing orders to deduplicate by tracking_number or order_number
    const { data: existingOrders } = await context.supabase
      .from("orders")
      .select("id, order_number, tracking_number");

    const existingByResi = new Map<string, any>();
    const existingByOrderNum = new Map<string, any>();

    (existingOrders || []).forEach((o: any) => {
      if (o.tracking_number) existingByResi.set(String(o.tracking_number).trim(), o);
      if (o.order_number) existingByOrderNum.set(String(o.order_number).trim(), o);
    });

    let createdCount = 0;
    let updatedCount = 0;

    for (const o of orderList) {
      const resi = String(o.resi || o.no_order || o.tracking_number || o.id || "").trim();
      const rawOrderNum =
        o.order_number || o.no_order || (resi ? `LNCH-${resi}` : `LNCH-${Date.now()}`);
      const phone = normalizePhone(
        o.phone ||
          o.recipient_phone ||
          o.receiver_phone ||
          o.contact?.phone ||
          o.recipient?.phone ||
          o.receiver?.phone ||
          o.customer?.phone ||
          o.customer_phone,
      );
      const customerName = (
        o.name ||
        o.recipient_name ||
        o.receiver_name ||
        o.contact?.name ||
        o.recipient?.name ||
        o.receiver?.name ||
        o.customer?.name ||
        "Pelanggan Lincah"
      ).trim();
      const address = o.address || o.recipient_address || o.full_address || "";
      const courierCode = String(o.courier || "jne")
        .replace(/^lincah:/i, "")
        .toLowerCase();
      const serviceCode = o.courier_service || o.service || "REG";
      const totalAmount = Number(o.cod_price || o.product_price || o.total || 0);
      const isCod = o.type === "cod" || Boolean(o.is_cod);
      const weightKg = Number(o.weight || 1);
      const weightG = Math.round(weightKg * 1000);
      const status = mapLincahStatus(o.status || "processing");
      const productName = o.product_name || "Produk Lincah";
      const qty = Number(o.quantity || 1);

      const existingObj =
        (resi ? existingByResi.get(resi) : null) || existingByOrderNum.get(rawOrderNum);

      const orderPayload: Record<string, any> = {
        order_number: rawOrderNum,
        customer_name: customerName,
        phone: phone || "081234567890",
        recipient_name: customerName,
        recipient_phone: phone || "081234567890",
        full_address: address,
        courier: `lincah:${courierCode}`,
        service: serviceCode,
        tracking_number: resi || null,
        status: status,
        payment_status: isCod ? "cod" : "paid",
        source: "Lincah API",
        total: totalAmount,
        weight_g: weightG,
        destination_subdistrict_id:
          typeof o.destination === "string" ? o.destination : o.destination?.code || null,
        note: o.note || `Imported from Lincah API`,
        updated_at: new Date().toISOString(),
      };

      if (existingObj?.id) {
        // Update existing order in OMS
        const { error: uErr } = await context.supabase
          .from("orders")
          .update(orderPayload)
          .eq("id", existingObj.id);
        if (!uErr) updatedCount++;
      } else {
        // Insert new order into OMS
        const { data: newOrder, error: iErr } = await context.supabase
          .from("orders")
          .insert(orderPayload)
          .select("id")
          .single();

        if (!iErr && newOrder?.id) {
          createdCount++;
          // Insert order item
          try {
            await context.supabase.from("order_items").insert({
              order_id: newOrder.id,
              name: productName,
              qty: qty,
              price: totalAmount > 0 ? Math.round(totalAmount / qty) : 0,
              weight_g: weightG,
            });
          } catch {}
        }
      }
    }

    // Also sync customers so CRM stays up to date
    try {
      await syncCustomersFromOrdersHandler(context.supabase);
    } catch {}

    return {
      success: true,
      totalFetched: orderList.length,
      count: createdCount + updatedCount,
      createdCount,
      updatedCount,
    };
  });
