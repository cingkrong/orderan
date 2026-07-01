import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const customCourierSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  description: z.string().optional().default(""),
  etd: z.string().optional().default("-"),
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
  weight_unit: z.enum(["g", "kg"]).default("g"),
});


export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("settings").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
