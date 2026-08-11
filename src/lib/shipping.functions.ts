import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLincahConfig, loadLocalLincahConfig } from "./lincah.functions";
import { lookupJneZona } from "./jne-zona-map";

const DEFAULT_COURIERS = "jne:sicepat:jnt:pos:tiki:anteraja:ide:wahana";
const CACHE_TTL_HOURS = 24;

function extractLincahFromCustom(customCouriers: any): Record<string, any> | null {
  if (Array.isArray(customCouriers)) {
    const entry = customCouriers.find((c: any) => c?.__lincah);
    return entry?.__lincah ?? null;
  }
  return null;
}

export const LINCAH_DISCOUNT_TABLE = [
  { courier_code: "jne", courier_name: "JNE Reguler / YES", service_pattern: "REG|YES|CTC", is_cod: true, discount_percent: 30, cod_fee_percent: 3.33, special_terms: "Return Fee gratis Jawa–Bali dan diskon 50% luar Jawa–Bali & Cashback 30% (tersedia Flat Rate di beberapa wilayah)" },
  { courier_code: "jne", courier_name: "JNE Reguler / YES", service_pattern: "REG|YES|CTC", is_cod: false, discount_percent: 25, cod_fee_percent: 0, special_terms: "Tersedia Flat Rate di beberapa wilayah, Return Fee gratis Jawa–Bali & diskon 50% luar Jawa - Bali." },
  { courier_code: "jne", courier_name: "JNE / Trucking", service_pattern: "JTR|TRUCK", is_cod: false, discount_percent: 5, cod_fee_percent: 0, special_terms: "Return Fee gratis Jawa - Bali dan diskon 50% luar Jawa - Bali." },
  { courier_code: "jnt", courier_name: "J&T Express", service_pattern: "EZ|REG|EXPRESS", is_cod: true, discount_percent: 25, cod_fee_percent: 3.33, special_terms: "Return Fee tidak gratis" },
  { courier_code: "jnt", courier_name: "J&T Express", service_pattern: "EZ|REG|EXPRESS", is_cod: false, discount_percent: 25, cod_fee_percent: 0, special_terms: "Return Fee tidak gratis" },
  { courier_code: "jnt", courier_name: "J&T Cargo", service_pattern: "CARGO", is_cod: false, discount_percent: 20, cod_fee_percent: 0, special_terms: "Return Fee tidak gratis" },
  { courier_code: "sap", courier_name: "SAPX", service_pattern: ".*", is_cod: true, discount_percent: 45, cod_fee_percent: 3.33, special_terms: "Return Fee gratis" },
  { courier_code: "sap", courier_name: "SAPX", service_pattern: ".*", is_cod: false, discount_percent: 40, cod_fee_percent: 0, special_terms: "Return Fee gratis" },
  { courier_code: "ninja", courier_name: "Ninja Express", service_pattern: ".*", is_cod: true, discount_percent: 50, cod_fee_percent: 3.33, special_terms: "Return Fee gratis" },
  { courier_code: "ninja", courier_name: "Ninja Express", service_pattern: ".*", is_cod: false, discount_percent: 40, cod_fee_percent: 0, special_terms: "Return Fee gratis" },
  { courier_code: "ide", courier_name: "ID Express", service_pattern: ".*", is_cod: true, discount_percent: 30, cod_fee_percent: 3.33, special_terms: "tersedia flat rate di beberapa wilayah & Return Fee gratis" },
  { courier_code: "ide", courier_name: "ID Express", service_pattern: ".*", is_cod: false, discount_percent: 20, cod_fee_percent: 0, special_terms: "tersedia flat rate di beberapa wilayah & Return Fee gratis" },
  { courier_code: "anteraja", courier_name: "AnterAja", service_pattern: ".*", is_cod: true, discount_percent: 30, cod_fee_percent: 3.33, special_terms: "Return Fee Gratis" },
  { courier_code: "anteraja", courier_name: "AnterAja", service_pattern: ".*", is_cod: false, discount_percent: 25, cod_fee_percent: 0, special_terms: "Return Fee Gratis" },
  { courier_code: "lion", courier_name: "Lion Parcel", service_pattern: ".*", is_cod: true, discount_percent: 20, cod_fee_percent: 3.33, special_terms: "Return Fee Gratis" },
  { courier_code: "lion", courier_name: "Lion Parcel", service_pattern: ".*", is_cod: false, discount_percent: 20, cod_fee_percent: 0, special_terms: "Return Fee Gratis" },
  { courier_code: "sicepat", courier_name: "SiCepat", service_pattern: ".*", is_cod: true, discount_percent: 35, cod_fee_percent: 3.33, special_terms: "Return Fee Gratis (apabila minimum cap 20%)" },
  { courier_code: "sicepat", courier_name: "SiCepat", service_pattern: ".*", is_cod: false, discount_percent: 30, cod_fee_percent: 0, special_terms: "Return Fee Gratis (apabila minimum cap 20%)" },
  { courier_code: "paxel", courier_name: "Paxel", service_pattern: ".*", is_cod: false, discount_percent: 0, cod_fee_percent: 0, special_terms: "Return Fee tidak gratis" },
];

export function resolveLincahDiscount(
  courierCode: string,
  serviceName: string,
  isCod: boolean,
  customDiscountMap?: Record<string, { cod_discount?: number; non_cod_discount?: number }>,
) {
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

  const officialMax = match ? match.discount_percent : isCod ? 25 : 20;
  const codFee = match ? match.cod_fee_percent : isCod ? 3.33 : 0;
  const terms = match ? match.special_terms : "";

  // Check custom seller store discount setting
  let effectiveDiscount = officialMax;
  if (customDiscountMap && customDiscountMap[code]) {
    const customVal = isCod
      ? customDiscountMap[code].cod_discount
      : customDiscountMap[code].non_cod_discount;
    if (typeof customVal === "number" && !isNaN(customVal)) {
      // RULE: Custom seller discount CANNOT exceed official Lincah maximum cap!
      effectiveDiscount = Math.min(Math.max(0, customVal), officialMax);
    }
  }

  const sellerMarginProfitPercent = officialMax - effectiveDiscount;

  return {
    discount_percent: effectiveDiscount,
    official_max_discount: officialMax,
    seller_margin_percent: sellerMarginProfitPercent,
    cod_fee_percent: codFee,
    special_terms: terms,
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

/**
 * Terapkan Flat Ongkir JNE berdasarkan zona dari spreadsheet.
 * Zona A/B -> abPrice, Zona C/D -> cdPrice
 * Lookup berdasarkan: DEST code, kode pos, atau kecamatan+kota
 */
function applyJneFlatOngkir(
  services: ShippingService[],
  zona: "A" | "B" | "C" | "D",
  abPrice: number,
  cdPrice: number,
): ShippingService[] {
  const isZoneAB = zona === "A" || zona === "B";
  const flatPrice = isZoneAB ? abPrice : cdPrice;
  const zoneName = isZoneAB ? "A/B" : "C/D";

  return services.map((s) => {
    if ((s.courier_code || "").toLowerCase() !== "jne" || s.custom) return s;
    const originalPrice = s.original_value ?? s.value;
    return {
      ...s,
      value: flatPrice,
      original_value: originalPrice > flatPrice ? originalPrice : flatPrice,
      discount_percent: originalPrice > flatPrice ? Math.round((1 - flatPrice / originalPrice) * 100) : 0,
      special_terms: ("Flat Rate Zona " + zoneName + " (" + zona + ")" + (s.special_terms ? " \u2014 " + s.special_terms : "")).trim(),
    };
  });
}

export const getShippingCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        destination_subdistrict_id: z.string().min(1),
        dest_kecamatan: z.string().optional().default(""),
        dest_kota: z.string().optional().default(""),
        dest_zip: z.string().optional().default(""),
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
    const embeddedLincah = extractLincahFromCustom((settings as any)?.custom_couriers);

    const activeCouriersList: string[] = Array.isArray(localConfig?.lincah_couriers)
      ? localConfig.lincah_couriers
      : Array.isArray((settings as any)?.lincah_couriers)
        ? (settings as any).lincah_couriers
        : Array.isArray(embeddedLincah?.lincah_couriers)
          ? embeddedLincah.lincah_couriers
          : Array.isArray(settings?.active_couriers)
            ? settings!.active_couriers
            : ["jne", "sap", "ninja", "sicepat", "jnt", "anteraja", "lion", "ide", "pos", "wahana"];

    const active = activeCouriersList;
    const lincahActive = active;

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

          const weightKg = Math.max(0.1, Number((weightG / 1000).toFixed(3)));

          const lincahPayload = {
            isPickup: true,
            isCod: isCod,
            dimensions: [1, 1, 1],
            weight: weightKg,
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
          // DEBUG: Log raw Lincah API response to determine price format
          console.log("[LINCAH ONGKIR RAW RESPONSE]", JSON.stringify(json.data?.slice?.(0, 2) ?? json, null, 2));
          const lincahList = Array.isArray(json.data) ? json.data : [];
          const customCouriersData = (settings?.custom_couriers as Record<string, any>) ?? {};
          const customDiscountMap = customCouriersData.__courier_discounts ?? {};

          services = lincahList.flatMap((c: any) => {
            const courierCode = String(c.code || c.courier || "lincah").toLowerCase();
            const courierName = String(c.name || courierCode.toUpperCase());
            const rates = Array.isArray(c.costs || c.services) ? (c.costs || c.services) : [c];
            return rates.map((rItem: any) => {
              const serviceName = String(rItem.service || rItem.type || "REG");
              const costObj = typeof rItem.cost === "object" ? rItem.cost : null;
              const rawOriginal = costObj ? (costObj.value ?? 0) : Number(rItem.cost || rItem.price || rItem.value || 0);
              const rawAfter = costObj && costObj.afterDiscount !== undefined ? costObj.afterDiscount : rawOriginal;
              const rule = resolveLincahDiscount(courierCode, serviceName, isCod, customDiscountMap);

              // DEBUG: Log raw Lincah API values to determine actual format
              console.log(`[LINCAH RAW] ${courierCode}/${serviceName}: rawOriginal=${rawOriginal}, rawAfter=${rawAfter}, costObj=`, JSON.stringify(costObj));

              // Use raw values directly from Lincah API — they are already in Rupiah
              // Lincah Open API returns cost.value in standard Rupiah (e.g. 6000 = Rp 6.000)
              let originalVal = rawOriginal;
              let finalVal = rawAfter;
              let discPercent = costObj?.discountValue !== undefined ? Number(costObj.discountValue) : 0;

              // If Lincah API didn't return afterDiscount or returned same price, apply official Lincah discount table
              if ((finalVal === originalVal || discPercent === 0) && rule.discount_percent > 0 && originalVal > 0) {
                discPercent = rule.discount_percent;
                finalVal = Math.round(originalVal * (1 - discPercent / 100));
              }

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
            try {
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
            } catch (cacheErr) {
              console.warn("Failed to cache shipping rates:", cacheErr);
            }
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

    // Terapkan Flat Ongkir JNE jika diaktifkan (lookup zona dari spreadsheet)
    const flatEnabled =
      localConfig.jne_flat_ongkir_enabled ??
      embeddedLincah?.jne_flat_ongkir_enabled ??
      false;
    if (flatEnabled) {
      const flatAbPrice = Number(
        localConfig.jne_flat_zone_ab_price ??
        embeddedLincah?.jne_flat_zone_ab_price ??
        9000
      );
      const flatCdPrice = Number(
        localConfig.jne_flat_zone_cd_price ??
        embeddedLincah?.jne_flat_zone_cd_price ??
        11000
      );
      const destCode = (data.destination_subdistrict_id || "").toUpperCase();

      console.log("[FlatOngkir] destCode:", destCode);

      // Step 1: Try lookup by Lincah dest code (unlikely to match JNE codes)
      let zona = lookupJneZona({ destCode });
      console.log("[FlatOngkir] lookup by destCode:", zona);

      // Step 2: Try lookup by form metadata (kecamatan, kota, zip from destination search)
      if (!zona && (data.dest_kecamatan || data.dest_kota || data.dest_zip)) {
        zona = lookupJneZona({
          zipCode: data.dest_zip,
          kecamatan: data.dest_kecamatan,
          kota: data.dest_kota,
        });
        console.log("[FlatOngkir] lookup by form metadata:", zona,
          `(kec=${data.dest_kecamatan}, kota=${data.dest_kota}, zip=${data.dest_zip})`);
      }

      // Step 3: Fallback - try Lincah API search (last resort)
      if (!zona) {
        try {
          const config = await getLincahConfig(context.supabase);
          const searchUrl = `${config.baseUrl}/district/search?q=${encodeURIComponent(destCode)}&limit=1`;
          const destRes = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${config.apiKey}`, "partner-id": config.partnerId },
          });
          const destJson = await destRes.json();
          const destInfo = destJson?.data?.[0];
          if (destInfo) {
            zona = lookupJneZona({
              zipCode: destInfo.zipcode || destInfo.zip_code || "",
              kecamatan: destInfo.name || destInfo.subdistrict_name || "",
              kota: destInfo.city || destInfo.city_name || "",
            });
            console.log("[FlatOngkir] lookup by API fallback:", zona);
          }
        } catch (err) {
          console.error("[FlatOngkir] Lincah API error:", err);
        }
      }

      if (zona) {
        console.log("[FlatOngkir] Applying flat rate zona:", zona);
        services = applyJneFlatOngkir(services, zona, flatAbPrice, flatCdPrice);
      } else {
        console.warn("[FlatOngkir] No zona found for destCode:", destCode, "- using normal rates");
      }
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
        description: c?.description && c.description !== "Custom" ? c.description : "Jasa Kirim",
        value: price,
        original_value: price,
        discount_percent: 0,
        special_terms: "",
        cod_fee_percent: 0,
        etd: c?.etd ?? "-",
        custom: true,
      });
    }

    return services;
  });
