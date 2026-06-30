import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RO_BASE = "https://api.rajaongkir.com/starter";

async function rajaongkir(path: string, init?: RequestInit) {
  const key = process.env.RAJAONGKIR_API_KEY;
  if (!key) throw new Error("RAJAONGKIR_API_KEY not configured");
  const res = await fetch(`${RO_BASE}${path}`, {
    ...init,
    headers: {
      key,
      "content-type": "application/x-www-form-urlencoded",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { rajaongkir: { status: { code: number; description: string }; results?: unknown } };
  if (!res.ok || json.rajaongkir?.status?.code !== 200) {
    throw new Error(json.rajaongkir?.status?.description || `RajaOngkir error (${res.status})`);
  }
  return json.rajaongkir;
}

// Seed cities cache from RajaOngkir if empty.
export const syncCities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error: cerr } = await context.supabase
      .from("rajaongkir_cities")
      .select("city_id", { count: "exact", head: true });
    if (cerr) throw new Error(cerr.message);
    if ((count ?? 0) > 0) return { inserted: 0, total: count };

    const r = await rajaongkir("/city");
    const rows = (r.results as Array<{
      city_id: string;
      province_id: string;
      province: string;
      type: string;
      city_name: string;
      postal_code: string;
    }>).map((c) => ({
      city_id: c.city_id,
      province_id: c.province_id,
      province: c.province,
      type: c.type,
      city_name: c.city_name,
      postal_code: c.postal_code,
    }));

    // batch insert
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await context.supabase.from("rajaongkir_cities").insert(chunk);
      if (error) throw new Error(error.message);
    }
    return { inserted: rows.length, total: rows.length };
  });

export const searchCities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const q = data.q.trim();
    let query = context.supabase
      .from("rajaongkir_cities")
      .select("city_id, city_name, province, type, postal_code")
      .order("city_name")
      .limit(20);
    if (q) query = query.ilike("city_name", `%${q}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getShippingCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        destination_city_id: z.string().min(1),
        weight_g: z.number().int().min(1),
        courier: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: settings, error: serr } = await context.supabase
      .from("settings")
      .select("origin_city_id")
      .eq("id", 1)
      .maybeSingle();
    if (serr) throw new Error(serr.message);
    if (!settings?.origin_city_id) {
      throw new Error("Set warehouse origin city in Settings first");
    }
    const body = new URLSearchParams({
      origin: settings.origin_city_id,
      destination: data.destination_city_id,
      weight: String(Math.max(1, data.weight_g)),
      courier: data.courier,
    }).toString();
    const r = await rajaongkir("/cost", { method: "POST", body });
    const results = r.results as Array<{
      code: string;
      name: string;
      costs: Array<{
        service: string;
        description: string;
        cost: Array<{ value: number; etd: string; note: string }>;
      }>;
    }>;
    const first = results?.[0];
    return {
      courier: first?.code ?? data.courier,
      courier_name: first?.name ?? data.courier,
      services: (first?.costs ?? []).map((c) => ({
        service: c.service,
        description: c.description,
        value: c.cost?.[0]?.value ?? 0,
        etd: c.cost?.[0]?.etd ?? "",
      })),
    };
  });
