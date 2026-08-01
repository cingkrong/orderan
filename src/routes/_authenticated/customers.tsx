import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listCustomers, syncCustomersFromOrders } from "@/lib/customers.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatIDR } from "@/lib/format";
import { Search, RefreshCw, Users, UserCheck, Truck, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const fetchAll = useServerFn(listCustomers);
  const syncFn = useServerFn(syncCustomersFromOrders);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["customers"], queryFn: () => fetchAll() });
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "regular" | "dropshipper">("all");

  const syncMutation = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (res) => {
      toast.success(`Berhasil menyinkronkan data pelanggan (${res.count} diperbarui)`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal sinkronisasi data");
    },
  });

  const allCustomers = data ?? [];

  // Auto sync from existing orders if no customer records exist
  useEffect(() => {
    if (!isLoading && data && data.length === 0 && !syncMutation.isPending && !syncMutation.isSuccess) {
      syncMutation.mutate();
    }
  }, [isLoading, data]);

  const isDropshipper = (c: any) =>
    Array.isArray(c.tags) && c.tags.some((t: string) => t.toLowerCase().includes("dropship"));

  const dropshipperList = allCustomers.filter(isDropshipper);
  const regularList = allCustomers.filter((c) => !isDropshipper(c));

  const currentTabList =
    activeTab === "dropshipper"
      ? dropshipperList
      : activeTab === "regular"
        ? regularList
        : allCustomers;

  const filtered = currentTabList.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.phone.includes(q) ||
      (Array.isArray(c.tags) && c.tags.some((t: string) => t.toLowerCase().includes(q.toLowerCase()))),
  );

  const totalSpent = allCustomers.reduce((s, c) => s + Number(c.total_spent || 0), 0);

  return (
    <div className="space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pelanggan & Dropshipper</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Daftar pelanggan dan dropshipper yang otomatis tersimpan dari pesanan
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`size-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Menyinkronkan..." : "Sync dari Pesanan"}
        </Button>
      </div>

      {/* METRIC STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Users className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Pelanggan</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">{allCustomers.length}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600">
            <Truck className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Daftar Dropshipper</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">{dropshipperList.length}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600">
            <ShoppingBag className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Transaksi</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">{formatIDR(totalSpent)}</div>
          </div>
        </Card>
      </div>

      {/* FILTER & TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full md:w-auto"
        >
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              Semua ({allCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="regular" className="text-xs sm:text-sm">
              Pelanggan ({regularList.length})
            </TabsTrigger>
            <TabsTrigger value="dropshipper" className="text-xs sm:text-sm">
              Dropshipper ({dropshipperList.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 text-xs sm:text-sm"
            placeholder="Cari nama, telepon, atau tag..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* CUSTOMER & DROPSHIPPER TABLE */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Nama / Telepon</th>
                <th className="p-3 font-medium">Tipe / Tag</th>
                <th className="p-3 font-medium text-right">Pesanan</th>
                <th className="p-3 font-medium text-right">Total Belanja</th>
                <th className="p-3 font-medium">Alamat Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="p-3">
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground">
                    {activeTab === "dropshipper"
                      ? "Belum ada data dropshipper tersimpan"
                      : "Tidak ada pelanggan ditemukan"}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const addr = (c.last_address as any)?.full_address;
                  const isDs = isDropshipper(c);
                  return (
                    <tr
                      key={c.id}
                      className="border-t hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate({ to: "/customers/$id", params: { id: c.id } })}
                    >
                      <td className="p-3">
                        <div className="font-medium flex items-center gap-2">
                          {c.name}
                          {isDs && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-600 bg-blue-50">
                              Dropshipper
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{c.phone}</div>
                      </td>
                      <td className="p-3">
                        {Array.isArray(c.tags) && c.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.tags.map((t: string) => (
                              <Badge
                                key={t}
                                variant={t.toLowerCase().includes("dropship") ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium">{c.total_orders}</td>
                      <td className="p-3 text-right tabular-nums font-medium">
                        {formatIDR(c.total_spent)}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                        {addr || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
