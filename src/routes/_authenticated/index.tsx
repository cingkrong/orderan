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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard label="Orders today" value={data?.todayCount} icon={ShoppingCart} loading={isLoading} />
        <StatCard label="Pending" value={data?.pending} icon={Clock} loading={isLoading} tone="warning" />
        <StatCard label="Processing" value={data?.processing} icon={ShoppingCart} loading={isLoading} tone="info" />
        <StatCard label="Shipped" value={data?.shipped} icon={Truck} loading={isLoading} tone="primary" />
        <StatCard
          label="Revenue today"
          value={data ? formatIDR(data.revenueToday) : undefined}
          icon={DollarSign}
          loading={isLoading}
          tone="success"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Orders by source</h2>
            <span className="text-xs text-muted-foreground">Last 500 orders</span>
          </div>
          <div className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.bySource?.length ?? 0) === 0 ? (
              <Empty label="No orders yet" />
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

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent orders</h2>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              : (data?.recent ?? []).length === 0
              ? <Empty label="No recent orders" />
              : data!.recent.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => navigate({ to: "/orders/$id", params: { id: o.id } })}
                    className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{o.order_number}</span>
                      <Badge className={STATUS_TONE[o.status]} variant="secondary">
                        {STATUS_LABEL[o.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span className="truncate">{formatIDR(o.total)}</span>
                      <span>{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</span>
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
}: {
  label: string;
  value: string | number | undefined;
  icon: typeof ShoppingCart;
  loading?: boolean;
  tone?: "warning" | "info" | "primary" | "success";
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
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={`size-7 grid place-items-center rounded-md ${toneClass}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums">
        {loading ? <Skeleton className="h-7 w-16" /> : value ?? 0}
      </div>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="grid place-items-center h-full text-sm text-muted-foreground">{label}</div>;
}
