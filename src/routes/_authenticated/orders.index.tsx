import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CourierLogo } from "@/components/courier-logo";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listOrders, updateOrderStatus } from "@/lib/orders.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIDR, STATUS_LABEL, STATUS_TONE, SOURCES, COURIER_LABEL, COURIERS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, Search, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: OrdersList,
});

const STATUSES = ["pending", "confirmed", "processing", "shipped", "completed", "cancelled"] as const;

function OrdersList() {
  const fetchOrders = useServerFn(listOrders);
  const updateStatus = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [courier, setCourier] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["orders", { search, status, source, courier }],
    queryFn: () =>
      fetchOrders({
        data: {
          search,
          status: status === "all" ? null : (status as any),
          source: source === "all" ? null : source,
          courier: courier === "all" ? null : courier,
          limit: 100,
        },
      }),
  });

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const bulkMutate = useMutation({
    mutationFn: (newStatus: string) =>
      updateStatus({ data: { ids: selectedIds, status: newStatus as any } }),
    onSuccess: () => {
      toast.success(`${selectedIds.length} pesanan diperbarui`);
      setSelected({});
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage every shipment in one place</p>
        </div>
        <Button asChild>
          <Link to="/orders/new"><Plus className="size-4 mr-1" />Pesanan baru</Link>
        </Button>
      </div>

      <Card className="p-3 md:p-4 space-y-3">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-11 md:h-9"
            placeholder="Cari pesanan, pelanggan, resi…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-auto min-w-[110px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-auto min-w-[100px] h-9 text-xs"><SelectValue placeholder="Sumber" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={courier} onValueChange={setCourier}>
            <SelectTrigger className="w-auto min-w-[100px] h-9 text-xs"><SelectValue placeholder="Kurir" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All couriers</SelectItem>
              {COURIERS.map((c) => <SelectItem key={c} value={c}>{COURIER_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-accent">
            <span className="text-sm font-medium">{selectedIds.length} dipilih</span>
            <Select onValueChange={(v) => bulkMutate.mutate(v)}>
              <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Atur status…" /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/labels", search: { ids: selectedIds.join(",") } as any })}
            >
              <Printer className="size-4 mr-1" /> Cetak label
            </Button>
          </div>
        )}
      </Card>

      {/* ═══ Mobile: Card-based order list ═══ */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (data ?? []).length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">Tidak ada pesanan</Card>
        ) : (
          data!.map((o) => (
            <Card
              key={o.id}
              className="p-3 active:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => navigate({ to: "/orders/$id", params: { id: o.id } })}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium">{o.order_number}</span>
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-5", STATUS_TONE[o.status])}>
                      {STATUS_LABEL[o.status]}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium mt-1">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{o.city}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-sm tabular-nums">{formatIDR(o.total)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(o.created_at), "dd MMM HH:mm", { locale: idLocale })}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  {o.courier ? (
                    <>
                      <CourierLogo courier={o.courier} size="sm" />
                      <span className="text-xs font-medium">{COURIER_LABEL[o.courier] ?? o.courier}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Belum ada kurir</span>
                  )}
                </div>
                {o.source && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{o.source}</span>}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* ═══ Desktop: Table view ═══ */}
      <Card className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 w-10"></th>
                <th className="p-3 font-medium">Pesanan</th>
                <th className="p-3 font-medium">Pelanggan</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Kurir</th>
                <th className="p-3 font-medium text-right">Total</th>
                <th className="p-3 font-medium">Sumber</th>
                <th className="p-3 font-medium">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : (data ?? []).length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Tidak ada pesanan</td></tr>
              ) : (
                data!.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate({ to: "/orders/$id", params: { id: o.id } })}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!selected[o.id]}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [o.id]: !!v }))}
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs">{o.order_number}</div>
                      {o.tracking_number && <div className="text-xs text-muted-foreground mt-0.5">{o.tracking_number}</div>}
                      {((o as any).label_print_count ?? 0) > 0 && (
                        <Badge variant="outline" className="mt-1 text-[10px] px-1 py-0 h-4">
                          Label ✓ {(o as any).label_print_count}×
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.phone} · {o.city}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </td>
                    <td className="p-3 text-xs">
                      {o.courier ? (
                        <div className="flex items-center gap-1.5">
                          <CourierLogo courier={o.courier} size="sm" />
                          <span className="font-medium text-xs">{COURIER_LABEL[o.courier] ?? o.courier} {o.service ?? ""}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-right font-medium tabular-nums">{formatIDR(o.total)}</td>
                    <td className="p-3 text-xs">{o.source ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(o.created_at), "dd MMM HH:mm", { locale: idLocale })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
