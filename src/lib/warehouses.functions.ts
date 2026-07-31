import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLincahConfig } from "./lincah.functions";

const warehouseInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  sender_name: z.string().nullable().optional(),
  sender_phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  origin_subdistrict_id: z.string().nullable().optional(),
  origin_label: z.string().nullable().optional(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
export type WarehouseInput = z.infer<typeof warehouseInput>;

export const listWarehouses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let warehouses: any[] = [];
    try {
      const { data } = await context.supabase
        .from("warehouses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      warehouses = data ?? [];
    } catch (e) {
      console.warn("Supabase warehouses query failed, using Lincah fallback:", e);
    }

    // Fetch Lincah API user profile & address database
    let lincahUser: any = null;
    let lincahAddresses: any[] = [];
    try {
      const config = await getLincahConfig(context.supabase);
      const [meRes, addrRes] = await Promise.all([
        fetch(`${config.baseUrl}/me`, {
          headers: { Authorization: `Bearer ${config.apiKey}`, "partner-id": config.partnerId },
        }).then((r) => r.json()).catch(() => ({})),
        fetch(`${config.baseUrl}/address`, {
          headers: { Authorization: `Bearer ${config.apiKey}`, "partner-id": config.partnerId },
        }).then((r) => r.json()).catch(() => ({})),
      ]);
      if (meRes?.success) lincahUser = meRes.data;
      if (addrRes?.success && Array.isArray(addrRes.data)) lincahAddresses = addrRes.data;
    } catch (e) {
      console.warn("Could not fetch Lincah profile/addresses for warehouse sync:", e);
    }

    // If local warehouses list is empty, build from Lincah addresses or Lincah profile default
    if (warehouses.length === 0) {
      if (lincahAddresses.length > 0) {
        return lincahAddresses.map((addr: any, idx: number) => ({
          id: addr.id || `lincah-addr-${idx}`,
          name: addr.name || addr.label || `Gudang Lincah ${idx + 1}`,
          sender_name: addr.sender_name || lincahUser?.name || "Maularis Admin",
          sender_phone: addr.phone || lincahUser?.phone || "081226227771",
          address: addr.address || addr.fullName || "-",
          origin_subdistrict_id: addr.district || addr.code || "33.72.01",
          origin_label: addr.fullName || addr.district_name || "Laweyan, Surakarta, Jawa Tengah 57148",
          is_default: idx === 0,
          is_active: true,
        }));
      }

      return [
        {
          id: "lincah-default-warehouse",
          name: "Gudang Utama (Lincah.id)",
          sender_name: lincahUser?.name || "Maularis Admin",
          sender_phone: lincahUser?.phone || "081226227771",
          address: "Jl. Kawung 23A, Sondakan, Laweyan, Surakarta",
          origin_subdistrict_id: "33.72.01",
          origin_label: "Laweyan, Surakarta, Jawa Tengah 57148",
          is_default: true,
          is_active: true,
        },
      ];
    }

    // Ensure existing warehouses use Lincah origin_subdistrict_id format ('33.72.01')
    return warehouses.map((w) => {
      const originId = String(w.origin_subdistrict_id || "");
      if (!/^\d{2}\.\d{2}/.test(originId)) {
        return {
          ...w,
          sender_name: w.sender_name || lincahUser?.name || "Maularis Admin",
          sender_phone: w.sender_phone || lincahUser?.phone || "081226227771",
          origin_subdistrict_id: "33.72.01",
          origin_label: w.origin_label || "Laweyan, Surakarta, Jawa Tengah 57148",
        };
      }
      return w;
    });
  });

export const upsertWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => warehouseInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.is_default) {
      await context.supabase.from("warehouses").update({ is_default: false }).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const { id, ...rest } = data;

    // Synchronize to Lincah address API if configured
    try {
      const config = await getLincahConfig(context.supabase);
      await fetch(`${config.baseUrl}/address`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "partner-id": config.partnerId,
        },
        body: JSON.stringify({
          name: rest.name,
          phone: rest.sender_phone || "081226227771",
          address: rest.address || rest.name,
          district: rest.origin_subdistrict_id || "33.72.01",
          note: rest.sender_name || rest.name,
        }),
      });
    } catch (lincahErr) {
      console.warn("Failed to sync warehouse to Lincah address API:", lincahErr);
    }

    if (id && !id.startsWith("lincah-")) {
      const { error } = await context.supabase.from("warehouses").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: inserted, error } = await context.supabase
      .from("warehouses")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deleteWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id.startsWith("lincah-")) return { ok: true };
    const { error } = await context.supabase.from("warehouses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
