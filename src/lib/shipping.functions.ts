import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RO_BASE = "https://rajaongkir.komerce.id/api/v1";
const DEFAULT_COURIERS = "jne:sicepat:jnt:pos:tiki:anteraja:ide:wahana";

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
  if (!res.ok || (code !== 200 && code !== 201)) {
    throw new Error(
      json.meta?.message || `RajaOngkir error (${code}) ${json.meta?.status ?? ""}`.trim(),
    );
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

export const getShippingCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        destination_subdistrict_id: z.string().min(1),
        weight_g: z.number().int().min(1),
        courier: z.string().min(1).default(DEFAULT_COURIERS),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: settings, error: serr } = await context.supabase
      .from("settings")
      .select("origin_subdistrict_id")
      .eq("id", 1)
      .maybeSingle();
    if (serr) throw new Error(serr.message);
    if (!settings?.origin_subdistrict_id) {
      throw new Error("Set warehouse origin di Settings terlebih dahulu");
    }
    const body = new URLSearchParams({
      origin: settings.origin_subdistrict_id,
      destination: data.destination_subdistrict_id,
      weight: String(Math.max(1, data.weight_g)),
      courier: data.courier,
    }).toString();
    const r = await rajaongkir("/calculate/domestic-cost", { method: "POST", body });
    const rows = Array.isArray(r.data) ? (r.data as Array<Record<string, unknown>>) : [];
    const services = rows.map((row) => {
      const code = String(row.code ?? row.courier ?? "").toLowerCase();
      const name = String(row.name ?? row.courier_name ?? code.toUpperCase());
      const service = String(row.service ?? "");
      const description = String(row.description ?? "");
      const value = Number(row.cost ?? 0);
      const etd = String(row.etd ?? "");
      return {
        service: `${code.toUpperCase()} ${service}`.trim(),
        courier_code: code,
        courier_name: name,
        description: description || service,
        value,
        etd,
      };
    });
    return { services };
  });
