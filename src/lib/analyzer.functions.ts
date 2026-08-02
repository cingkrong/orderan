import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const analyzerFilterSchema = z.object({
  month: z.union([z.number(), z.string()]).default("all"),
  year: z.number().default(new Date().getFullYear()),
});

export type BestSellerItem = {
  id: string;
  name: string;
  total_qty: number;
  total_revenue: number;
  image_url?: string | null;
};

export type BestCustomerItem = {
  customer_id?: string | null;
  name: string;
  phone: string;
  order_count: number;
  total_spent: number;
  role: string;
  city: string;
  stars: number;
};

export type CustomerLocationItem = {
  rank: number;
  location: string;
  order_count: number;
  percentage: number;
};

export const getMarketAnalyzer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => analyzerFilterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { month, year } = data;

    // Build date filter range if specific month & year are passed
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (month !== "all" && Number(month) >= 1 && Number(month) <= 12) {
      const m = Number(month);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (year) {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      startDate = start.toISOString();
      endDate = end.toISOString();
    }

    // 1. Query orders within range
    let ordersQuery = context.supabase
      .from("orders")
      .select("id, customer_id, customer_name, phone, recipient_name, recipient_phone, is_dropship, dropship_name, dropship_phone, city, district, province, total, created_at, status");

    if (startDate && endDate) {
      ordersQuery = ordersQuery.gte("created_at", startDate).lte("created_at", endDate);
    }

    const { data: orders, error: ordersErr } = await ordersQuery;
    if (ordersErr) throw new Error(ordersErr.message);

    const validOrders = (orders || []).filter((o: any) => o.status !== "cancelled");
    const totalOrderCount = validOrders.length;
    const orderIds = validOrders.map((o: any) => o.id);

    // 2. Best Sellers Calculation (from order_items)
    let bestSellers: BestSellerItem[] = [];
    if (orderIds.length > 0) {
      const { data: items } = await context.supabase
        .from("order_items")
        .select("id, name, qty, price, product_id, variant_id")
        .in("order_id", orderIds);

      const productMap = new Map<string, { name: string; total_qty: number; total_revenue: number; product_id?: string }>();
      (items || []).forEach((it: any) => {
        const key = it.name || "Produk";
        const existing = productMap.get(key) || {
          name: key,
          total_qty: 0,
          total_revenue: 0,
          product_id: it.product_id,
        };
        existing.total_qty += Number(it.qty || 0);
        existing.total_revenue += Number(it.price || 0) * Number(it.qty || 0);
        productMap.set(key, existing);
      });

      // Fetch images for top products if product_id exists
      const topList = Array.from(productMap.values())
        .sort((a, b) => b.total_qty - a.total_qty)
        .slice(0, 10);

      const productIds = topList.map((t) => t.product_id).filter(Boolean) as string[];
      let imageMap = new Map<string, string>();
      if (productIds.length > 0) {
        const { data: prodRows } = await context.supabase
          .from("products")
          .select("id, variants:product_variants(image_url)")
          .in("id", productIds);

        (prodRows || []).forEach((p: any) => {
          const img = (p.variants || []).find((v: any) => v.image_url)?.image_url;
          if (img) imageMap.set(p.id, img);
        });
      }

      bestSellers = topList.map((t, idx) => ({
        id: `seller-${idx}`,
        name: t.name,
        total_qty: t.total_qty,
        total_revenue: t.total_revenue,
        image_url: t.product_id ? imageMap.get(t.product_id) || null : null,
      }));
    }

    // 3. Best Customers Calculation
    const customerMap = new Map<
      string,
      {
        customer_id?: string | null;
        name: string;
        phone: string;
        order_count: number;
        total_spent: number;
        role: string;
        city: string;
      }
    >();

    validOrders.forEach((o: any) => {
      const isDs = o.is_dropship && o.dropship_phone;
      const phone = String(isDs ? o.dropship_phone : o.phone || "").trim();
      const name = isDs ? o.dropship_name || "Dropshipper" : o.customer_name || "Pelanggan";
      const role = isDs ? "Dropshipper" : "Pelanggan";
      const city = o.city || o.district || "Gudang";

      if (phone) {
        const existing = customerMap.get(phone) || {
          customer_id: o.customer_id || null,
          name,
          phone,
          order_count: 0,
          total_spent: 0,
          role,
          city,
        };
        existing.order_count += 1;
        existing.total_spent += Number(o.total || 0);
        existing.city = city || existing.city;
        if (!existing.customer_id && o.customer_id) existing.customer_id = o.customer_id;
        customerMap.set(phone, existing);
      }
    });

    const bestCustomers: BestCustomerItem[] = Array.from(customerMap.values())
      .sort((a, b) => b.order_count - a.order_count || b.total_spent - a.total_spent)
      .slice(0, 10)
      .map((c) => {
        let stars = 1;
        if (c.order_count >= 20 || c.total_spent >= 5000000) stars = 3;
        else if (c.order_count >= 5 || c.total_spent >= 1000000) stars = 2;
        return {
          ...c,
          stars,
        };
      });

    // 4. Customer Location Calculation
    const locationMap = new Map<string, number>();
    validOrders.forEach((o: any) => {
      const loc = (o.city || o.district || o.province || "Lokasi Lain").trim();
      if (loc) {
        locationMap.set(loc, (locationMap.get(loc) || 0) + 1);
      }
    });

    const customerLocations: CustomerLocationItem[] = Array.from(locationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, order_count], idx) => ({
        rank: idx + 1,
        location,
        order_count,
        percentage: totalOrderCount > 0 ? Math.round((order_count / totalOrderCount) * 100) : 0,
      }));

    return {
      totalOrderCount,
      bestSellers,
      bestCustomers,
      customerLocations,
    };
  });
