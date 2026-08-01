import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLincahConfig } from "./lincah.functions";

export const getUserProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const claims = context.claims;

    // 1. Fetch profile from profiles table
    const { data: profileRow } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    // 2. Fetch settings
    const { data: settingsRow } = await context.supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    // 3. Fetch user order stats
    const { count: totalOrders } = await context.supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    const { data: totalSpentData } = await context.supabase
      .from("orders")
      .select("total");

    const totalRevenue = (totalSpentData || []).reduce(
      (sum: number, o: any) => sum + Number(o.total || 0),
      0,
    );

    // 4. Try fetching Lincah account profile
    let lincahProfile: any = null;
    try {
      const config = await getLincahConfig(context.supabase);
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "partner-id": config.partnerId,
      };

      const [meRes, balanceRes] = await Promise.all([
        fetch(`${config.baseUrl}/me`, { headers }).then((r) => r.json()).catch(() => ({})),
        fetch(`${config.baseUrl}/balance`, { headers }).then((r) => r.json()).catch(() => ({})),
      ]);

      if (meRes?.data || balanceRes?.data) {
        lincahProfile = {
          user: meRes.data || null,
          balance: balanceRes.data?.balance ?? 0,
          config: { env: config.env, partnerId: config.partnerId },
        };
      }
    } catch {}

    const email = claims.email || claims.user_metadata?.email || "user@maularis.com";
    const fullName =
      profileRow?.full_name ||
      claims.user_metadata?.full_name ||
      claims.user_metadata?.name ||
      settingsRow?.sender_name ||
      email.split("@")[0];

    return {
      userId,
      email,
      fullName,
      role: claims.role || "admin",
      createdAt: claims.created_at || profileRow?.created_at || new Date().toISOString(),
      profileRow,
      settings: settingsRow,
      stats: {
        totalOrders: totalOrders || 0,
        totalRevenue,
      },
      lincahProfile,
    };
  });

const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Nama lengkap tidak boleh kosong"),
  senderName: z.string().optional(),
  senderPhone: z.string().optional(),
  senderCity: z.string().optional(),
  senderAddress: z.string().optional(),
});

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    // 1. Upsert profiles table
    const { error: profileErr } = await context.supabase
      .from("profiles")
      .upsert({
        id: userId,
        full_name: data.fullName,
        updated_at: new Date().toISOString(),
      });

    if (profileErr) console.warn("Failed updating profiles row:", profileErr.message);

    // 2. Update settings sender details if provided
    if (data.senderName || data.senderPhone || data.senderCity || data.senderAddress) {
      const { data: existingSettings } = await context.supabase
        .from("settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      const updateData: Record<string, any> = {};
      if (data.senderName) updateData.sender_name = data.senderName;
      if (data.senderPhone) updateData.sender_phone = data.senderPhone;
      if (data.senderCity) updateData.sender_city = data.senderCity;
      if (data.senderAddress) updateData.sender_address = data.senderAddress;

      if (existingSettings) {
        await context.supabase
          .from("settings")
          .update(updateData as any)
          .eq("id", 1);
      }
    }

    return { success: true };
  });
