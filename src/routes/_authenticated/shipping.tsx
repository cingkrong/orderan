import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOrders, setTracking } from "@/lib/orders.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { COURIERS, COURIER_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shipping")({
  component: ShippingPage,
});

function ShippingPage() {
  const fetchOrders = useServerFn(listOrders);
  const setTrack = useServerFn(setTracking);
  const qc = useQueryClient();
  const [courier, setCourier] = useState<string>("all");
  const [pending, setPending] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["shipping-orders", courier],
    queryFn: () =>
      fetchOrders({
        data: { search: "", status: null, source: null, courier: courier === "all" ? null : courier, limit: 100 },
      }),
  });

  const mut = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      setTrack({ data: { id, tracking_number: value, markShipped: true } }),
    onSuccess: () => {
      toast.success("Tersimpan");
      qc.invalidateQueries({ queryKey: ["shipping-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const queue = (data ?? []).filter((o) => !["completed", "cancelled"].includes(o.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Shipping</h1>
        <p className="text-muted-foreground text-sm mt-1">Input tracking numbers and update shipment status</p>
      </div>
      <Card className="p-4 flex items-center gap-2">
        <Select value={courier} onValueChange={setCourier}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Kurir" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All couriers</SelectItem>
            {COURIERS.map((c) => <SelectItem key={c} value={c}>{COURIER_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{queue.length} pengiriman tertunda</span>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Pesanan</th>
                <th className="p-3 font-medium">Pelanggan</th>
                <th className="p-3 font-medium">Kurir</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">No. resi</th>
                <th className="p-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : queue.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Semua pengiriman selesai 🎉</td></tr>
              ) : (
                queue.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="p-3">
                      <Link to="/orders/$id" params={{ id: o.id }} className="font-mono text-xs hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="p-3">
                      <div>{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.city}</div>
                    </td>
                    <td className="p-3">{o.courier ? `${COURIER_LABEL[o.courier] ?? o.courier} ${o.service ?? ""}` : "—"}</td>
                    <td className="p-3"><Badge variant="secondary" className={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                    <td className="p-3">
                      <Input
                        placeholder="Masukkan resi"
                        value={pending[o.id] ?? o.tracking_number ?? ""}
                        onChange={(e) => setPending((p) => ({ ...p, [o.id]: e.target.value }))}
                      />
                    </td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        disabled={!pending[o.id] || mut.isPending}
                        onClick={() => mut.mutate({ id: o.id, value: pending[o.id] })}
                      >
                        Save & Ship
                      </Button>
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
