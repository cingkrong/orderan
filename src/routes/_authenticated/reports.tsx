import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { pnlSummary, pnlTrend, pnlByProduct, pnlBySource } from "@/lib/reports.functions";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expenses.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatIDR } from "@/lib/format";
import { format, subDays, startOfMonth } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Package as PackageIcon, Percent } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function ReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(iso(startOfMonth(today)));
  const [to, setTo] = useState(iso(today));
  const [bucket, setBucket] = useState<"day" | "month">("day");

  const sumFn = useServerFn(pnlSummary);
  const trendFn = useServerFn(pnlTrend);
  const productFn = useServerFn(pnlByProduct);
  const sourceFn = useServerFn(pnlBySource);

  const period = { from, to };

  const sumQ = useQuery({ queryKey: ["pnl-sum", from, to], queryFn: () => sumFn({ data: period }) });
  const trendQ = useQuery({ queryKey: ["pnl-trend", from, to, bucket], queryFn: () => trendFn({ data: { ...period, bucket } }) });
  const productQ = useQuery({ queryKey: ["pnl-prod", from, to], queryFn: () => productFn({ data: period }) });
  const sourceQ = useQuery({ queryKey: ["pnl-src", from, to], queryFn: () => sourceFn({ data: period }) });

  function setPreset(days: number) {
    setTo(iso(today));
    if (days === 0) setFrom(iso(startOfMonth(today)));
    else setFrom(iso(subDays(today, days - 1)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Laporan Laba Rugi</h1>
        <p className="text-muted-foreground text-sm mt-1">Analisis profit per periode, produk, dan sumber traffic.</p>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Dari</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Sampai</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setPreset(1)}>Hari ini</Button>
          <Button size="sm" variant="outline" onClick={() => setPreset(7)}>7 hari</Button>
          <Button size="sm" variant="outline" onClick={() => setPreset(30)}>30 hari</Button>
          <Button size="sm" variant="outline" onClick={() => setPreset(0)}>Bulan ini</Button>
        </div>
      </Card>

      {/* Summary */}
      {sumQ.isLoading ? (
        <Skeleton className="h-32" />
      ) : sumQ.data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Stat label="Pesanan" value={String(sumQ.data.orderCount)} icon={PackageIcon} />
            <Stat label="Revenue" value={formatIDR(sumQ.data.revenue)} icon={DollarSign} />
            <Stat label="HPP" value={formatIDR(sumQ.data.cogs)} icon={TrendingDown} tone="warning" />
            <Stat label="Gross Profit" value={formatIDR(sumQ.data.grossProfit)} icon={TrendingUp} tone="info" />
            <Stat label="Total Biaya" value={formatIDR(sumQ.data.totalExpense)} icon={TrendingDown} tone="warning" />
            <Stat
              label="Net Profit"
              value={formatIDR(sumQ.data.netProfit)}
              icon={sumQ.data.netProfit >= 0 ? TrendingUp : TrendingDown}
              tone={sumQ.data.netProfit >= 0 ? "success" : "destructive"}
            />
          </div>
          <Card className="p-4 flex flex-wrap gap-2 items-center text-sm">
            <span className="text-muted-foreground">Rincian biaya:</span>
            {Object.entries(sumQ.data.byCategory).length === 0 && <span className="text-muted-foreground italic">— belum ada pengeluaran —</span>}
            {Object.entries(sumQ.data.byCategory).map(([k, v]) => (
              <span key={k} className="px-2 py-1 rounded bg-muted">
                {EXPENSE_CATEGORY_LABEL[k] ?? k}: <span className="font-mono">{formatIDR(v)}</span>
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1 text-muted-foreground">
              <Percent className="size-3" /> Margin: <span className="font-mono font-semibold">{sumQ.data.margin.toFixed(1)}%</span>
            </span>
          </Card>
        </>
      ) : null}

      {/* Trend chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Tren Revenue vs Profit</h2>
          <div className="flex gap-1">
            <Button size="sm" variant={bucket === "day" ? "default" : "outline"} onClick={() => setBucket("day")}>Harian</Button>
            <Button size="sm" variant={bucket === "month" ? "default" : "outline"} onClick={() => setBucket("month")}>Bulanan</Button>
          </div>
        </div>
        <div className="h-72">
          {trendQ.isLoading ? (
            <Skeleton className="h-full" />
          ) : (trendQ.data ?? []).length === 0 ? (
            <div className="grid place-items-center h-full text-sm text-muted-foreground">Tidak ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendQ.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number) => formatIDR(v)}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="var(--info)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="var(--success)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Breakdown tabs */}
      <Tabs defaultValue="product">
        <TabsList>
          <TabsTrigger value="product">Per Produk</TabsTrigger>
          <TabsTrigger value="source">Per Sumber / ROAS</TabsTrigger>
        </TabsList>
        <TabsContent value="product">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Produk</th>
                    <th className="p-3 font-medium text-right">Qty</th>
                    <th className="p-3 font-medium text-right">Revenue</th>
                    <th className="p-3 font-medium text-right">HPP</th>
                    <th className="p-3 font-medium text-right">Gross Profit</th>
                    <th className="p-3 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {productQ.isLoading ? (
                    <tr><td colSpan={6} className="p-3"><Skeleton className="h-8" /></td></tr>
                  ) : (productQ.data ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Tidak ada data</td></tr>
                  ) : (
                    productQ.data!.map((r) => (
                      <tr key={r.name} className="border-t">
                        <td className="p-3 font-medium">{r.name}</td>
                        <td className="p-3 text-right tabular-nums">{r.qty}</td>
                        <td className="p-3 text-right tabular-nums">{formatIDR(r.revenue)}</td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">{formatIDR(r.cogs)}</td>
                        <td className={`p-3 text-right tabular-nums font-semibold ${r.gross_profit >= 0 ? "text-success" : "text-destructive"}`}>{formatIDR(r.gross_profit)}</td>
                        <td className="p-3 text-right tabular-nums">{r.margin_pct.toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="source">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Sumber</th>
                    <th className="p-3 font-medium text-right">Pesanan</th>
                    <th className="p-3 font-medium text-right">Revenue</th>
                    <th className="p-3 font-medium text-right">Gross Profit</th>
                    <th className="p-3 font-medium text-right">Biaya Iklan</th>
                    <th className="p-3 font-medium text-right">ROAS</th>
                    <th className="p-3 font-medium text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceQ.isLoading ? (
                    <tr><td colSpan={7} className="p-3"><Skeleton className="h-8" /></td></tr>
                  ) : (sourceQ.data ?? []).length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Tidak ada data</td></tr>
                  ) : (
                    sourceQ.data!.map((r) => (
                      <tr key={r.source} className="border-t">
                        <td className="p-3 font-medium">{r.source}</td>
                        <td className="p-3 text-right tabular-nums">{r.orders}</td>
                        <td className="p-3 text-right tabular-nums">{formatIDR(r.revenue)}</td>
                        <td className="p-3 text-right tabular-nums">{formatIDR(r.gross_profit)}</td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">{formatIDR(r.ad_spend)}</td>
                        <td className="p-3 text-right tabular-nums">{r.roas ? `${r.roas.toFixed(2)}×` : "—"}</td>
                        <td className={`p-3 text-right tabular-nums font-semibold ${r.net_profit >= 0 ? "text-success" : "text-destructive"}`}>{formatIDR(r.net_profit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  tone?: "warning" | "info" | "success" | "destructive";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning-foreground bg-warning/20"
      : tone === "info"
      ? "text-info bg-info/15"
      : tone === "success"
      ? "text-success bg-success/15"
      : tone === "destructive"
      ? "text-destructive bg-destructive/15"
      : "text-muted-foreground bg-muted";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={`size-7 grid place-items-center rounded-md ${toneClass}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 text-lg font-bold tabular-nums truncate">{value}</div>
    </Card>
  );
}
