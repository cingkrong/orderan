import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLincahConfig, saveLocalLincahConfig } from "./lincah.functions";

export type IntegrationPlugin = {
  id: string;
  name: string;
  category: "shipping" | "whatsapp" | "marketplace" | "payment" | "webhook";
  iconName: string;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
};

const updatePluginSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.any()),
});

export const getIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // 1. Load settings from database
    const { data: settings } = await context.supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const lincahConfig = await getLincahConfig(context.supabase as any);

    const custom = (settings?.custom_couriers as Record<string, any>) ?? {};
    const addonData = (custom.__addons as Record<string, any>) ?? {};

    // 2. Map default plugins list
    const plugins: IntegrationPlugin[] = [
      {
        id: "lincah",
        name: "Lincah.id (Aggregator Ekspedisi)",
        category: "shipping",
        iconName: "Truck",
        description:
          "Integrasi otomatis cek ongkir & booking resi pengiriman untuk 10+ ekspedisi (JNE, J&T, SiCepat, SAP, Ninja, AnterAja, Lion, dll).",
        enabled: Boolean(lincahConfig.apiKey && lincahConfig.partnerId),
        config: {
          apiKey: lincahConfig.apiKey || "",
          partnerId: lincahConfig.partnerId || "",
          env: lincahConfig.env || "development",
        },
      },
      {
        id: "whatsapp",
        name: "WhatsApp Gateway Notifikasi",
        category: "whatsapp",
        iconName: "MessageSquare",
        description:
          "Kirim notifikasi otomatis resi pengiriman, konfirmasi order, dan follow-up WhatsApp kepada pembeli.",
        enabled: Boolean(addonData.whatsapp?.enabled),
        config: {
          provider: addonData.whatsapp?.provider || "fonnte",
          apiKey: addonData.whatsapp?.apiKey || "",
          senderPhone: addonData.whatsapp?.senderPhone || "",
          autoResi: addonData.whatsapp?.autoResi ?? true,
        },
      },
      {
        id: "shopee",
        name: "Shopee Seller API",
        category: "marketplace",
        iconName: "ShoppingBag",
        description:
          "Sinkronkan otomatis pesanan & stok barang dari toko Shopee ke dashboard toko Anda.",
        enabled: Boolean(addonData.shopee?.enabled),
        config: {
          shopId: addonData.shopee?.shopId || "",
          partnerId: addonData.shopee?.partnerId || "",
          secretKey: addonData.shopee?.secretKey || "",
        },
      },
      {
        id: "tiktok",
        name: "TikTok Shop Integration",
        category: "marketplace",
        iconName: "Video",
        description:
          "Otomatisasi impor transaksi & data pelanggan dari TikTok Shop Seller Center.",
        enabled: Boolean(addonData.tiktok?.enabled),
        config: {
          appKey: addonData.tiktok?.appKey || "",
          appSecret: addonData.tiktok?.appSecret || "",
          shopCipher: addonData.tiktok?.shopCipher || "",
        },
      },
      {
        id: "tokopedia",
        name: "Tokopedia Seller API",
        category: "marketplace",
        iconName: "Store",
        description:
          "Integrasi pemrosesan pesanan toko Tokopedia dan penyesuaian stok real-time.",
        enabled: Boolean(addonData.tokopedia?.enabled),
        config: {
          fsId: addonData.tokopedia?.fsId || "",
          clientId: addonData.tokopedia?.clientId || "",
          clientSecret: addonData.tokopedia?.clientSecret || "",
        },
      },
      {
        id: "webhook",
        name: "Webhook & API Automation (n8n/Make)",
        category: "webhook",
        iconName: "Webhook",
        description:
          "Kirimkan webhook payload JSON real-time saat ada orderan baru atau perubahan status pengiriman.",
        enabled: Boolean(addonData.webhook?.enabled),
        config: {
          url: addonData.webhook?.url || "",
          secret: addonData.webhook?.secret || "",
          events: addonData.webhook?.events || ["order.created", "order.shipped"],
        },
      },
    ];

    return plugins;
  });

export const updateIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updatePluginSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, enabled, config } = data;

    if (id === "lincah") {
      const apiKeyVal = String(config.apiKey || "");
      const partnerIdVal = String(config.partnerId || "");
      const envVal = String(config.env || "development");

      // Save Lincah config locally and in DB
      saveLocalLincahConfig({
        lincah_api_key: apiKeyVal,
        lincah_partner_id: partnerIdVal,
        lincah_env: envVal,
      });

      await context.supabase
        .from("settings")
        .update({
          lincah_api_key: apiKeyVal || null,
          lincah_partner_id: partnerIdVal || null,
          lincah_env: envVal,
        })
        .eq("id", 1);
    } else {
      // Save addon config inside custom_couriers JSON object under __addons
      const { data: currentSettings } = await context.supabase
        .from("settings")
        .select("custom_couriers")
        .eq("id", 1)
        .maybeSingle();

      const existingCustom = (currentSettings?.custom_couriers as Record<string, any>) ?? {};
      const existingAddons = (existingCustom.__addons as Record<string, any>) ?? {};

      const updatedAddons = {
        ...existingAddons,
        [id]: {
          enabled,
          ...config,
          updated_at: new Date().toISOString(),
        },
      };

      const updatedCustom = {
        ...existingCustom,
        __addons: updatedAddons,
      };

      const { error } = await context.supabase
        .from("settings")
        .update({ custom_couriers: updatedCustom })
        .eq("id", 1);

      if (error) throw new Error(error.message);
    }

    return { success: true };
  });
