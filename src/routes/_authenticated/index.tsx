import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dashboardStats } from "@/lib/orders.functions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatIDR, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ShoppingCart, Clock, Truck, CheckCircle2, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const fetchStats = useServerFn(dashboardStats);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchStats(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Operations at a glance</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
        <StatCard label="Pesanan hari ini" value={data?.todayCount} icon={ShoppingCart} loading={isLoading} />
        <StatCard label="Tertunda" value={data?.pending} icon={Clock} loading={isLoading} tone="warning" />
        <StatCard label="Diproses" value={data?.processing} icon={ShoppingCart} loading={isLoading} tone="info" />
        <StatCard label="Dikirim" value={data?.shipped} icon={Truck} loading={isLoading} tone="primary" />
        <StatCard
          label="Pendapatan hari ini"
          value={data ? formatIDR(data.revenueToday) : undefined}
          icon={DollarSign}
          loading={isLoading}
          tone="success"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm md:text-base">Orders by source</h2>
            <span className="text-xs text-muted-foreground">Last 500 orders</span>
          </div>
          <div className="h-52 md:h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.bySource?.length ?? 0) === 0 ? (
              <Empty label="Belum ada pesanan" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.bySource ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="source" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm md:text-base">Recent orders</h2>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              : (data?.recent ?? []).length === 0
              ? <Empty label="Tidak ada pesanan terbaru" />
              : data!.recent.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => navigate({ to: "/orders/$id", params: { id: o.id } })}
                    className="w-full text-left p-2.5 rounded-md hover:bg-accent active:bg-accent transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-xs font-semibold text-primary truncate">{o.order_number}</span>
                      <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", STATUS_TONE[o.status])} variant="secondary">
                        {STATUS_LABEL[o.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs mt-1">
                      <span className="font-semibold text-foreground tabular-nums shrink-0">{formatIDR(o.total)}</span>
                      <span className="text-[10px] text-muted-foreground truncate shrink-0">
                        {formatDistanceToNow(new Date(o.created_at), { addSuffix: true, locale: idLocale })}
                      </span>
                    </div>
                  </button>
                ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  tone,
  className,
}: {
  label: string;
  value: string | number | undefined;
  icon: typeof ShoppingCart;
  loading?: boolean;
  tone?: "warning" | "info" | "primary" | "success";
  className?: string;
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning-foreground bg-warning/20"
      : tone === "info"
      ? "text-info bg-info/15"
      : tone === "primary"
      ? "text-primary bg-primary/15"
      : tone === "success"
      ? "text-success bg-success/15"
      : "text-muted-foreground bg-muted";
  return (
    <Card className={`p-3.5 md:p-4 ${className || ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</span>
        <span className={`size-7 grid place-items-center rounded-md shrink-0 ${toneClass}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 text-lg md:text-xl xl:text-2xl font-bold tabular-nums truncate">
        {loading ? <Skeleton className="h-7 w-16" /> : value ?? 0}
      </div>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="grid place-items-center h-full text-sm text-muted-foreground">{label}</div>;
}
