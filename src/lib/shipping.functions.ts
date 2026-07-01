import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RO_BASE = "https://rajaongkir.komerce.id/api/v1";
const DEFAULT_COURIERS = "jne:sicepat:jnt:pos:tiki:anteraja:ide:wahana";
const CACHE_TTL_HOURS = 24;

async function rajaongkir(
  path: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<{
  meta?: { code?: number; status?: string; message?: string };
  data?: unknown;
}> {
  const key = process.env.RAJAONGKIR_API_KEY;
  if (!key) throw new Error("RAJAONGKIR_API_KEY belum di-set di Settings → Secrets");
  const url = new URL(`${RO_BASE}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }
  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    res = await fetch(url.toString(), {
      ...init,
      signal: controller.signal,
      headers: {
        key,
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    clearTimeout(timeout);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("RajaOngkir fetch failed:", msg);
    throw new Error(`Tidak bisa menghubungi RajaOngkir (${msg})`);
  }
  let json: { meta?: { code?: number; status?: string; message?: string }; data?: unknown };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error(`RajaOngkir mengembalikan respons non-JSON (HTTP ${res.status})`);
  }
  const code = json.meta?.code ?? res.status;
  const msg = json.meta?.message ?? "";
  if (/not found/i.test(msg)) {
    return { meta: json.meta, data: [] };
  }
  if (!res.ok || (code !== 200 && code !== 201)) {
    throw new Error(msg || `RajaOngkir error (${code}) ${json.meta?.status ?? ""}`.trim());
  }

  return json;
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
  const id = String(raw.id ?? raw.subdistrict_id ?? "");
  const subdistrict = String(raw.subdistrict_name ?? "");
  const district = String(raw.district_name ?? "");
  const city = String(raw.city_name ?? "");
  const province = String(raw.province_name ?? "");
  const zip = String(raw.zip_code ?? raw.postal_code ?? "");
  const label = [subdistrict, district, city, province].filter(Boolean).join(", ");
  return {
    id,
    label: zip ? `${label} ${zip}` : label,
    subdistrict_name: subdistrict,
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
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (q.length < 3) return [] as Destination[];
    const r = await rajaongkir("/destination/domestic-destination", {
      method: "GET",
      query: { search: q, limit: String(data.limit), offset: "0" },
    });
    const rows = Array.isArray(r.data) ? (r.data as Array<Record<string, unknown>>) : [];
    return rows.map(toDestination);
  });

export type ShippingService = {
  service: string;
  courier_code: string;
  courier_name: string;
  description: string;
  value: number;
  etd: string;
  custom?: boolean;
};

// bucket weight to 100g so nearby weights hit the same cache row
function bucketWeight(w: number) {
  return Math.max(1, Math.ceil(Math.max(1, w) / 100) * 100);
}

export const getShippingCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        destination_subdistrict_id: z.string().min(1),
        weight_g: z.number().int().min(1),
        courier: z.string().min(1).default(DEFAULT_COURIERS),
        origin_subdistrict_id: z.string().nullable().optional(),
        force_refresh: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Load settings once for origin fallback + active/custom couriers
    const { data: settings } = await context.supabase
      .from("settings")
      .select("origin_subdistrict_id, active_couriers, custom_couriers")
      .eq("id", 1)
      .maybeSingle();

    const origin = data.origin_subdistrict_id || settings?.origin_subdistrict_id || "";
    if (!origin) throw new Error("Pilih gudang asal atau set origin di Pengaturan");

    const active: string[] = Array.isArray(settings?.active_couriers) && settings!.active_couriers.length > 0
      ? settings!.active_couriers
      : DEFAULT_COURIERS.split(":");
    // Intersect requested courier list with active
    const requested = data.courier.split(":").map((c) => c.trim().toLowerCase()).filter(Boolean);
    const courierList = requested.filter((c) => active.includes(c));
    const couriers = (courierList.length > 0 ? courierList : active).join(":");

    const bucket = bucketWeight(data.weight_g);
    const cacheKey = { origin, dest: data.destination_subdistrict_id, bucket, couriers };

    // Try cache
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
        if (ageMs < CACHE_TTL_HOURS * 3600_000) {
          services = (hit.services as ShippingService[]) ?? [];
          cached = true;
        }
      }
    }

    if (!cached) {
      const body = new URLSearchParams({
        origin,
        destination: data.destination_subdistrict_id,
        weight: String(Math.max(1, data.weight_g)),
        courier: couriers,
      }).toString();
      const r = await rajaongkir("/calculate/domestic-cost", { method: "POST", body });
      const rows = Array.isArray(r.data) ? (r.data as Array<Record<string, unknown>>) : [];
      services = rows.map((row) => {
        const code = String(row.code ?? row.courier ?? "").toLowerCase();
        const name = String(row.name ?? row.courier_name ?? code.toUpperCase());
        const service = String(row.service ?? "");
        const description = String(row.description ?? "");
        const value = Number(row.cost ?? 0);
        const etd = String(row.etd ?? "");
        return {
          service,
          courier_code: code,
          courier_name: name,
          description: description || service,
          value,
          etd,
        };
      });
      // Persist cache (upsert)
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

    // Append custom couriers from settings (always available, no API cost)
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
        etd: c?.etd ?? "-",
        custom: true,
      });
    }

    return { services, cached };
  });
