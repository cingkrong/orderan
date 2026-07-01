import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const periodInput = z.object({
  from: z.string(),
  to: z.string(),
  statuses: z.array(z.string()).optional(),
  paymentStatuses: z.array(z.string()).optional(),
});

type OrderRow = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string | null;
  source: string | null;
  campaign: string | null;
  subtotal: number | string;
  discount: number | string;
  marketplace_fee: number | string;
  shipping_cost: number | string;
  total: number | string;
};

type ItemRow = {
  order_id: string;
  product_id: string | null;
  name: string;
  qty: number;
  price: number | string;
  cost: number | string;
};

type ExpenseRow = {
  date: string;
  category: string;
  source: string | null;
  amount: number | string;
};

async function loadPeriod(
  supabase: { from: (t: string) => any },
  from: string,
  to: string,
  statuses?: string[],
  paymentStatuses?: string[],
): Promise<{ orders: OrderRow[]; items: ItemRow[]; expenses: ExpenseRow[] }> {
  const fromISO = `${from}T00:00:00.000Z`;
  const toISO = `${to}T23:59:59.999Z`;

  let q = supabase
    .from("orders")
    .select("id, created_at, status, payment_status, source, campaign, subtotal, discount, marketplace_fee, shipping_cost, total")
    .gte("created_at", fromISO)
    .lte("created_at", toISO);
  if (statuses && statuses.length > 0) q = q.in("status", statuses);
  else q = q.neq("status", "cancelled");
  if (paymentStatuses && paymentStatuses.length > 0) q = q.in("payment_status", paymentStatuses);
  const { data: orders, error: oe } = await q;
  if (oe) throw new Error(oe.message);

  const ids = (orders ?? []).map((o: OrderRow) => o.id);
  let items: ItemRow[] = [];
  if (ids.length) {
    const { data, error } = await supabase
      .from("order_items")
      .select("order_id, product_id, name, qty, price, cost")
      .in("order_id", ids);
    if (error) throw new Error(error.message);
    items = data ?? [];
  }

  const { data: expenses, error: ee } = await supabase
    .from("expenses")
    .select("date, category, source, amount")
    .gte("date", from)
    .lte("date", to);
  if (ee) throw new Error(ee.message);

  return { orders: orders ?? [], items, expenses: expenses ?? [] };
}

const num = (v: unknown) => Number(v ?? 0);

export const pnlSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodInput.parse(d))
  .handler(async ({ data, context }) => {
    const { orders, items, expenses } = await loadPeriod(context.supabase as any, data.from, data.to, data.statuses, data.paymentStatuses);
    const cogsMap: Record<string, number> = {};
    for (const it of items) cogsMap[it.order_id] = (cogsMap[it.order_id] ?? 0) + num(it.cost) * it.qty;

    let revenue = 0,
      discount = 0,
      cogs = 0,
      fee = 0;
    for (const o of orders) {
      revenue += num(o.subtotal) - num(o.discount);
      discount += num(o.discount);
      cogs += cogsMap[o.id] ?? 0;
      fee += num(o.marketplace_fee);
    }
    const grossProfit = revenue - cogs - fee;

    const byCategory: Record<string, number> = {};
    let totalExpense = 0;
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + num(e.amount);
      totalExpense += num(e.amount);
    }
    const netProfit = grossProfit - totalExpense;
    return {
      revenue,
      discount,
      cogs,
      marketplace_fee: fee,
      grossProfit,
      totalExpense,
      byCategory,
      netProfit,
      orderCount: orders.length,
      margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    };
  });

export const pnlTrend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    periodInput.extend({ bucket: z.enum(["day", "month"]).default("day") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { orders, items, expenses } = await loadPeriod(context.supabase as any, data.from, data.to, data.statuses, data.paymentStatuses);
    const cogsMap: Record<string, number> = {};
    for (const it of items) cogsMap[it.order_id] = (cogsMap[it.order_id] ?? 0) + num(it.cost) * it.qty;

    const bucketKey = (iso: string) => (data.bucket === "month" ? iso.slice(0, 7) : iso.slice(0, 10));
    const buckets: Record<string, { date: string; revenue: number; cogs: number; fee: number; expense: number }> = {};
    const ensure = (k: string) =>
      (buckets[k] ??= { date: k, revenue: 0, cogs: 0, fee: 0, expense: 0 });

    for (const o of orders) {
      const b = ensure(bucketKey(o.created_at));
      b.revenue += num(o.subtotal) - num(o.discount);
      b.cogs += cogsMap[o.id] ?? 0;
      b.fee += num(o.marketplace_fee);
    }
    for (const e of expenses) {
      const b = ensure(bucketKey(e.date));
      b.expense += num(e.amount);
    }
    return Object.values(buckets)
      .map((b) => ({
        date: b.date,
        revenue: b.revenue,
        grossProfit: b.revenue - b.cogs - b.fee,
        netProfit: b.revenue - b.cogs - b.fee - b.expense,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });

export const pnlByProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodInput.parse(d))
  .handler(async ({ data, context }) => {
    const { items } = await loadPeriod(context.supabase as any, data.from, data.to, data.statuses, data.paymentStatuses);
    const agg: Record<string, { name: string; qty: number; revenue: number; cogs: number }> = {};
    for (const it of items) {
      const k = it.product_id ?? it.name;
      const cur = (agg[k] ??= { name: it.name, qty: 0, revenue: 0, cogs: 0 });
      cur.qty += it.qty;
      cur.revenue += num(it.price) * it.qty;
      cur.cogs += num(it.cost) * it.qty;
    }
    return Object.values(agg)
      .map((r) => ({
        ...r,
        gross_profit: r.revenue - r.cogs,
        margin_pct: r.revenue > 0 ? ((r.revenue - r.cogs) / r.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.gross_profit - a.gross_profit);
  });

export const pnlBySource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodInput.parse(d))
  .handler(async ({ data, context }) => {
    const { orders, items, expenses } = await loadPeriod(context.supabase as any, data.from, data.to, data.statuses, data.paymentStatuses);
    const cogsMap: Record<string, number> = {};
    for (const it of items) cogsMap[it.order_id] = (cogsMap[it.order_id] ?? 0) + num(it.cost) * it.qty;

    const agg: Record<
      string,
      { source: string; orders: number; revenue: number; cogs: number; fee: number; ad_spend: number }
    > = {};
    const ensure = (s: string) =>
      (agg[s] ??= { source: s, orders: 0, revenue: 0, cogs: 0, fee: 0, ad_spend: 0 });

    for (const o of orders) {
      const s = ensure(o.source || "Unknown");
      s.orders += 1;
      s.revenue += num(o.subtotal) - num(o.discount);
      s.cogs += cogsMap[o.id] ?? 0;
      s.fee += num(o.marketplace_fee);
    }
    for (const e of expenses) {
      if (e.category !== "ads") continue;
      const s = ensure(e.source || "Unknown");
      s.ad_spend += num(e.amount);
    }
    return Object.values(agg)
      .map((r) => {
        const gross = r.revenue - r.cogs - r.fee;
        return {
          ...r,
          gross_profit: gross,
          net_profit: gross - r.ad_spend,
          roas: r.ad_spend > 0 ? r.revenue / r.ad_spend : null,
        };
      })
      .sort((a, b) => b.net_profit - a.net_profit);
  });

// Breakdown by status — always ignores the statuses filter, but honors date range
// and paymentStatuses. Useful to see "pending / processing / shipped / delivered / cancelled"
// side-by-side (e.g. omzet tertunda vs terkonfirmasi).
export const revenueBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodInput.parse(d))
  .handler(async ({ data, context }) => {
    const fromISO = `${data.from}T00:00:00.000Z`;
    const toISO = `${data.to}T23:59:59.999Z`;

    let q = (context.supabase as any)
      .from("orders")
      .select("id, status, payment_status, subtotal, discount, marketplace_fee")
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    if (data.paymentStatuses && data.paymentStatuses.length > 0) {
      q = q.in("payment_status", data.paymentStatuses);
    }
    const { data: orders, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (orders ?? []).map((o: any) => o.id);
    let items: ItemRow[] = [];
    if (ids.length) {
      const { data: it, error: ie } = await (context.supabase as any)
        .from("order_items")
        .select("order_id, product_id, name, qty, price, cost")
        .in("order_id", ids);
      if (ie) throw new Error(ie.message);
      items = it ?? [];
    }
    const cogsMap: Record<string, number> = {};
    for (const it of items) cogsMap[it.order_id] = (cogsMap[it.order_id] ?? 0) + num(it.cost) * it.qty;

    const agg: Record<string, { status: string; orders: number; revenue: number; cogs: number; fee: number }> = {};
    for (const o of orders ?? []) {
      const key = String(o.status ?? "unknown");
      const cur = (agg[key] ??= { status: key, orders: 0, revenue: 0, cogs: 0, fee: 0 });
      cur.orders += 1;
      cur.revenue += num(o.subtotal) - num(o.discount);
      cur.cogs += cogsMap[o.id] ?? 0;
      cur.fee += num(o.marketplace_fee);
    }
    return Object.values(agg)
      .map((r) => ({
        status: r.status,
        orders: r.orders,
        revenue: r.revenue,
        gross_profit: r.revenue - r.cogs - r.fee,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  });

