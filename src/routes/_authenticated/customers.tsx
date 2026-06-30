import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listCustomers } from "@/lib/customers.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIDR } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const fetchAll = useServerFn(listCustomers);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["customers"], queryFn: () => fetchAll() });
  const [q, setQ] = useState("");

  const filtered = (data ?? []).filter((c) =>
    !q ||
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.phone.includes(q),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground text-sm mt-1">Auto-created from orders</p>
      </div>
      <Card className="p-4">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari berdasarkan nama atau telepon" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Pelanggan</th>
                <th className="p-3 font-medium">Tag</th>
                <th className="p-3 font-medium text-right">Pesanan</th>
                <th className="p-3 font-medium text-right">Total belanja</th>
                <th className="p-3 font-medium">Alamat terakhir</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Tidak ada pelanggan</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate({ to: "/customers/$id", params: { id: c.id } })}
                  >
                    <td className="p-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </td>
                    <td className="p-3">
                      {c.tags?.length ? c.tags.map((t) => <Badge key={t} variant="secondary" className="mr-1">{t}</Badge>) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums">{c.total_orders}</td>
                    <td className="p-3 text-right tabular-nums">{formatIDR(c.total_spent)}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                      {(c.last_address as any)?.full_address ?? "—"}
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
