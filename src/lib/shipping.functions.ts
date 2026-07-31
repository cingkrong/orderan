import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLincahConfig, loadLocalLincahConfig } from "./lincah.functions";

const DEFAULT_COURIERS = "jne:sicepat:jnt:pos:tiki:anteraja:ide:wahana";
const CACHE_TTL_HOURS = 24;

export const LINCAH_DISCOUNT_TABLE = [
  { courier_code: "jne", courier_name: "JNE Reguler / YES", service_pattern: "REG|YES|CTC", is_cod: true, discount_percent: 30, cod_fee_percent: 3.33, special_terms: "Return Fee gratis Jawa–Bali & diskon 50% luar Jawa–Bali & Cashback 30%" },
  { courier_code: "jne", courier_name: "JNE Reguler / YES", service_pattern: "REG|YES|CTC", is_cod: false, discount_percent: 25, cod_fee_percent: 0, special_terms: "Tersedia Flat Rate, Return Fee gratis Jawa–Bali & diskon 50% luar Jawa–Bali" },
  { courier_code: "jne", courier_name: "JNE Trucking (JTR)", service_pattern: "JTR|TRUCK", is_cod: false, discount_percent: 5, cod_fee_percent: 0, special_terms: "Return Fee gratis Jawa-Bali dan diskon 50% luar Jawa-Bali" },
  { courier_code: "jnt", courier_name: "J&T Express", service_pattern: "EZ|REG|EXPRESS", is_cod: true, discount_percent: 25, cod_fee_percent: 3.33, special_terms: "Return Fee tidak gratis" },
  { courier_code: "jnt", courier_name: "J&T Express", service_pattern: "EZ|REG|EXPRESS", is_cod: false, discount_percent: 25, cod_fee_percent: 0, special_terms: "Return Fee tidak gratis" },
  { courier_code: "jnt", courier_name: "J&T Cargo", service_pattern: "CARGO", is_cod: false, discount_percent: 20, cod_fee_percent: 0, special_terms: "Return Fee tidak gratis" },
  { courier_code: "sap", courier_name: "SAPX", service_pattern: ".*", is_cod: true, discount_percent: 45, cod_fee_percent: 3.33, special_terms: "Return Fee gratis" },
  { courier_code: "sap", courier_name: "SAPX", service_pattern: ".*", is_cod: false, discount_percent: 40, cod_fee_percent: 0, special_terms: "Return Fee gratis" },
  { courier_code: "ninja", courier_name: "Ninja Express", service_pattern: ".*", is_cod: true, discount_percent: 50, cod_fee_percent: 3.33, special_terms: "Return Fee gratis" },
  { courier_code: "ninja", courier_name: "Ninja Express", service_pattern: ".*", is_cod: false, discount_percent: 40, cod_fee_percent: 0, special_terms: "Return Fee gratis" },
  { courier_code: "ide", courier_name: "ID Express", service_pattern: ".*", is_cod: true, discount_percent: 30, cod_fee_percent: 3.33, special_terms: "Tersedia flat rate di beberapa wilayah & Return Fee gratis" },
  { courier_code: "ide", courier_name: "ID Express", service_pattern: ".*", is_cod: false, discount_percent: 20, cod_fee_percent: 0, special_terms: "Tersedia flat rate di beberapa wilayah & Return Fee gratis" },
  { courier_code: "anteraja", courier_name: "AnterAja", service_pattern: ".*", is_cod: true, discount_percent: 30, cod_fee_percent: 3.33, special_terms: "Return Fee Gratis" },
  { courier_code: "anteraja", courier_name: "AnterAja", service_pattern: ".*", is_cod: false, discount_percent: 25, cod_fee_percent: 0, special_terms: "Return Fee Gratis" },
  { courier_code: "lion", courier_name: "Lion Parcel", service_pattern: ".*", is_cod: true, discount_percent: 20, cod_fee_percent: 3.33, special_terms: "Return Fee Gratis" },
  { courier_code: "lion", courier_name: "Lion Parcel", service_pattern: ".*", is_cod: false, discount_percent: 20, cod_fee_percent: 0, special_terms: "Return Fee Gratis" },
  { courier_code: "sicepat", courier_name: "SiCepat", service_pattern: ".*", is_cod: true, discount_percent: 35, cod_fee_percent: 3.33, special_terms: "Return Fee Gratis (apabila minimum cap 20%)" },
  { courier_code: "sicepat", courier_name: "SiCepat", service_pattern: ".*", is_cod: false, discount_percent: 30, cod_fee_percent: 0, special_terms: "Return Fee Gratis (apabila minimum cap 20%)" },
  { courier_code: "paxel", courier_name: "Paxel", service_pattern: ".*", is_cod: false, discount_percent: 0, cod_fee_percent: 0, special_terms: "Return Fee tidak gratis" },
];

export function resolveLincahDiscount(courierCode: string, serviceName: string, isCod: boolean) {
  const code = (courierCode || "").toLowerCase().trim();
  const service = (serviceName || "").toUpperCase().trim();

  const match = LINCAH_DISCOUNT_TABLE.find((row) => {
    if (row.is_cod !== isCod) return false;
    if (row.courier_code !== code && !code.includes(row.courier_code) && !row.courier_code.includes(code)) {
      if ((code === "idx" || code.includes("idexpress")) && row.courier_code === "ide") return true;
      return false;
    }
    if (row.service_pattern === ".*") return true;
    const reg = new RegExp(row.service_pattern, "i");
    return reg.test(service);
  });

  if (match) {
    return {
      discount_percent: match.discount_percent,
      cod_fee_percent: match.cod_fee_percent,
      special_terms: match.special_terms,
    };
  }

  return {
    discount_percent: isCod ? 25 : 20,
    cod_fee_percent: isCod ? 3.33 : 0,
    special_terms: "",
  };
}

export type Destination = {
  id: string;
  label: string;
  subdistrict_name: string;
  district_name: string;
  city_name: string;
  province_name: string;
  zip_code: string;
};

function toDestination(raw: Record<string, unknown>): Destination {
  const code = String(raw.code ?? "");
  const id = code || String(raw.subdistrict_id ?? raw.id ?? "");
  const district = String(raw.district_name ?? raw.district ?? raw.name ?? "");
  const subdistrict = String(raw.subdistrict_name ?? "");
  const city = String(raw.city_name ?? raw.city ?? "");
  const province = String(raw.province_name ?? raw.province ?? "");
  const zip = String(raw.zip_code ?? raw.postal_code ?? raw.zipcode ?? "");

  const parts: string[] = [];
  if (district) parts.push(district);
  else if (subdistrict) parts.push(subdistrict);
  if (city && city !== district) parts.push(city);
  if (province && province !== city) parts.push(province);

  const label = parts.join(", ");
  return {
    id,
    label: zip ? `${label} ${zip}` : label,
    subdistrict_name: subdistrict || district,
    district_name: district,
    city_name: city,
    province_name: province,
    zip_code: zip,
  };
}

export const searchDestinations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().default(""), limit: z.number().int().min(1).max(50).default(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const q = data.q.trim();
    if (q.length < 3) return [] as Destination[];
    
    // Search directly via Lincah.id District API
    try {
      const config = await getLincahConfig(context.supabase);
      const url = `${config.baseUrl}/district/search?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "partner-id": config.partnerId,
        },
      });
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : [];
      return list.slice(0, data.limit).map((item: any) => ({
        id: item.code || item.id || "",
        label: item.fullName || [item.name, item.city, item.province].filter(Boolean).join(", "),
        subdistrict_name: item.name || "",
        district_name: item.name || "",
        city_name: item.city || "",
        province_name: item.province || "",
        zip_code: item.zipcode || item.zip_code || "",
      }));
    } catch (e) {
      console.error("Lincah district search failed:", e);
      return [];
    }
  });

export type ShippingService = {
  service: string;
  courier_code: string;
  courier_name: string;
  description: string;
  value: number; // Price after discount used for calculating order total
  original_value?: number; // Normal price before discount
  discount_percent?: number; // Discount percentage (e.g. 40 for 40%)
  special_terms?: string;
  cod_fee_percent?: number;
  etd: string;
  custom?: boolean;
};

function bucketWeight(w: number) {
  return Math.max(1, Math.ceil(Math.max(1, w) / 100) * 100);
}

export const getShippingCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        destination_subdistrict_id: z.string().min(1),
        weight_g: z.number().int().default(1000),
        courier: z.string().optional().default(DEFAULT_COURIERS),
        origin_subdistrict_id: z.string().nullable().optional(),
        is_cod: z.boolean().default(false),
        force_refresh: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: settings } = await context.supabase
      .from("settings")
      .select("origin_subdistrict_id, sender_city, origin_label, active_couriers, custom_couriers")
      .eq("id", 1)
      .maybeSingle();

    const origin = data.origin_subdistrict_id || settings?.origin_subdistrict_id || "33.72.01";

    const localConfig = loadLocalLincahConfig() || {};
    const dbActive: string[] = Array.isArray(settings?.active_couriers) ? settings!.active_couriers : [];
    const lincahActive: string[] = Array.isArray(localConfig?.lincah_couriers)
      ? localConfig.lincah_couriers
      : Array.isArray((settings as any)?.lincah_couriers)
        ? (settings as any).lincah_couriers
        : ["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana"];

    const mergedActive = Array.from(new Set([...dbActive, ...lincahActive]));
    const active = mergedActive.length > 0 ? mergedActive : DEFAULT_COURIERS.split(":");

    const requested = (data.courier || DEFAULT_COURIERS).split(":").map((c) => c.trim().toLowerCase()).filter(Boolean);
    const courierList = requested.filter((c) => active.includes(c));
    const couriers = (courierList.length > 0 ? courierList : active).join(":");

    const weightG = Math.max(1, data.weight_g || 1000);
    const bucket = bucketWeight(weightG);
    const isCod = Boolean(data.is_cod);
    const cacheKey = { origin, dest: data.destination_subdistrict_id, bucket, couriers, isCod };

    let services: ShippingService[] = [];
    let cached = false;
    if (!data.force_refresh) {
      const { data: hit } = await context.supabase
        .from("shipping_rate_cache")
        .select("services, fetched_at")
        .eq("origin_subdistrict_id", cacheKey.origin)
        .eq("destination_subdistrict_id", cacheKey.dest)
        .eq("weight_bucket", cacheKey.bucket)
        .eq("couriers", cacheKey.couriers)
        .maybeSingle();
      if (hit && hit.fetched_at) {
        const ageMs = Date.now() - new Date(hit.fetched_at).getTime();
        const hitServices = (hit.services as ShippingService[]) ?? [];
        if (ageMs < CACHE_TTL_HOURS * 3600_000 && hitServices.some((s) => s.value > 0)) {
          services = hitServices;
          cached = true;
        }
      }
    }

    if (!cached) {
      try {
        const config = await getLincahConfig(context.supabase);

          // Resolve Lincah district origin code if origin is numeric or not in Lincah format
          let lincahOrigin = origin;
          if (!/^\d{2}\.\d{2}/.test(lincahOrigin)) {
            try {
              const queryStr = settings?.sender_city || settings?.origin_label || "Surakarta";
              const sRes = await fetch(`${config.baseUrl}/district/search?q=${encodeURIComponent(queryStr)}`, {
                headers: {
                  Authorization: `Bearer ${config.apiKey}`,
                  "partner-id": config.partnerId,
                },
              });
              const sJson = await sRes.json();
              if (sJson.data && sJson.data.length > 0 && sJson.data[0].code) {
                lincahOrigin = sJson.data[0].code;
              }
            } catch {}
          }

          const lincahPayload = {
            isPickup: true,
            isCod: isCod,
            dimensions: [1, 1, 1],
            weight: weightG,
            packagePrice: 0,
            origin: { code: lincahOrigin },
            destination: { code: data.destination_subdistrict_id },
            logistics: lincahActive.length > 0 ? lincahActive : undefined,
          };
          const res = await fetch(`${config.baseUrl}/ongkir`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
              "partner-id": config.partnerId,
            },
            body: JSON.stringify(lincahPayload),
          });
          const json = await res.json();
          const lincahList = Array.isArray(json.data) ? json.data : [];
          services = lincahList.flatMap((c: any) => {
            const courierCode = String(c.code || c.courier || "lincah").toLowerCase();
            const courierName = String(c.name || courierCode.toUpperCase());
            const rates = Array.isArray(c.costs || c.services) ? (c.costs || c.services) : [c];
            return rates.map((rItem: any) => {
              const serviceName = String(rItem.service || rItem.type || "REG");
              const costObj = typeof rItem.cost === "object" ? rItem.cost : null;
              const rawOriginal = costObj ? (costObj.value ?? 0) : Number(rItem.cost || rItem.price || rItem.value || 0);
              const rawAfter = costObj && costObj.afterDiscount !== undefined ? costObj.afterDiscount : rawOriginal;

              // Lincah API returns amounts in milli-Rupiah (e.g. 15000000 = Rp 15.000)
              const originalVal = rawOriginal > 100000 ? Math.round(rawOriginal / 1000) : rawOriginal;
              const finalVal = rawAfter > 100000 ? Math.round(rawAfter / 1000) : rawAfter;

              // Trust Lincah API discount directly — do NOT re-apply internal discount table
              const discPercent = costObj?.discountValue !== undefined ? Number(costObj.discountValue) : 0;

              const rule = resolveLincahDiscount(courierCode, serviceName, isCod);
              const etdVal = costObj?.etd || rItem.etd || rItem.estimate || "-";

              return {
                service: serviceName,
                courier_code: courierCode,
                courier_name: courierName,
                description: String(rItem.service_name || rItem.description || rItem.name || rItem.service || "Lincah.id"),
                value: finalVal,
                original_value: originalVal > finalVal ? originalVal : finalVal,
                discount_percent: discPercent,
                special_terms: rule.special_terms,
                cod_fee_percent: isCod ? rule.cod_fee_percent : 0,
                etd: String(etdVal),
              };
            });
          });

          if (services.length > 0 && services.some((s) => s.value > 0)) {
            await context.supabase
              .from("shipping_rate_cache")
              .upsert(
                {
                  origin_subdistrict_id: cacheKey.origin,
                  destination_subdistrict_id: cacheKey.dest,
                  weight_bucket: cacheKey.bucket,
                  couriers: cacheKey.couriers,
                  services,
                  fetched_at: new Date().toISOString(),
                },
                { onConflict: "origin_subdistrict_id,destination_subdistrict_id,weight_bucket,couriers" },
              );
          }
        } catch (lincahErr) {
          console.error("Lincah rate calculation failed:", lincahErr);
        }
      }

    // ALWAYS filter services to match active couriers configured in settings
    if (active.length > 0) {
      services = services.filter((s) => {
        if (s.custom) return true;
        const code = (s.courier_code || "").toLowerCase();
        return active.includes(code);
      });
    }

    // Append custom couriers from settings
    const customs = Array.isArray(settings?.custom_couriers) ? (settings!.custom_couriers as Array<any>) : [];
    for (const c of customs) {
      const name = String(c?.name ?? "").trim();
      const price = Number(c?.price ?? 0);
      if (!name || price < 0) continue;
      services.push({
        service: name,
        courier_code: "custom",
        courier_name: name,
        description: c?.description ?? "Custom",
        value: price,
        original_value: price,
        discount_percent: 0,
        special_terms: "",
        cod_fee_percent: 0,
        etd: c?.etd ?? "-",
        custom: true,
      });
    }

    return { services, cached };
  });
