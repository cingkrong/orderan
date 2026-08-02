import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMarketAnalyzer } from "@/lib/analyzer.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StorageImage } from "@/components/storage-image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Heart,
  MapPin,
  Search,
  Star,
  ShoppingBag,
  Users,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/analyzer")({
  component: MarketAnalyzerPage,
});

const MONTH_OPTIONS = [
  { value: "all", label: "All Months" },
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  currentYear.toString(),
  (currentYear - 1).toString(),
  (currentYear - 2).toString(),
];

function MarketAnalyzerPage() {
  const fetchAnalyzer = useServerFn(getMarketAnalyzer);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [filterQuery, setFilterQuery] = useState<{ month: string; year: number }>({
    month: "all",
    year: currentYear,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["market-analyzer", filterQuery.month, filterQuery.year],
    queryFn: () =>
      fetchAnalyzer({
        data: {
          month: filterQuery.month === "all" ? "all" : Number(filterQuery.month),
          year: filterQuery.year,
        },
      }),
  });

  function handleApplyFilter() {
    setFilterQuery({
      month: selectedMonth,
      year: Number(selectedYear),
    });
  }

  const bestSellers = data?.bestSellers ?? [];
  const bestCustomers = data?.bestCustomers ?? [];
  const customerLocations = data?.customerLocations ?? [];

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER PAGE TITLE & BREADCRUMB */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">Analyzer</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Home / Analyzer / Market Analyzer
          </p>
        </div>

        {/* TOP FILTER CONTROLS */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-background p-1.5 rounded-lg border shadow-sm">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Bulan" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] h-9 text-xs">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleApplyFilter}
          >
            <Search className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        /* 3-COLUMN ANALYZER GRID MATCHING SCREENSHOT */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* CARD 1: BEST SELLER */}
          <Card className="p-0 overflow-hidden border shadow-sm">
            <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2">
              <Package className="size-4 text-slate-500" />
              <h2 className="font-bold text-sm text-slate-700">Best Seller</h2>
            </div>

            <div className="divide-y max-h-[500px] overflow-y-auto">
              {bestSellers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  Belum ada data produk terlaris di periode ini
                </div>
              ) : (
                bestSellers.map((item) => (
                  <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="size-12 rounded-lg bg-amber-50 border flex items-center justify-center shrink-0 overflow-hidden">
                      {item.image_url ? (
                        <StorageImage path={item.image_url} className="size-full object-cover" />
                      ) : (
                        <Package className="size-6 text-amber-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-bold text-sm text-slate-800 truncate">{item.name}</div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border border-emerald-500 text-emerald-700 bg-emerald-50">
                        {item.total_qty} Item terjual
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t text-center bg-slate-50/30">
              <Link to="/products" className="text-xs text-muted-foreground hover:text-primary font-medium">
                View All
              </Link>
            </div>
          </Card>

          {/* CARD 2: BEST CUSTOMER */}
          <Card className="p-0 overflow-hidden border shadow-sm">
            <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2">
              <Heart className="size-4 text-slate-500" />
              <h2 className="font-bold text-sm text-slate-700">Best Customer</h2>
            </div>

            <div className="divide-y max-h-[500px] overflow-y-auto">
              {bestCustomers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  Belum ada data pelanggan di periode ini
                </div>
              ) : (
                bestCustomers.map((c, idx) => (
                  <div key={idx} className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="text-center shrink-0 min-w-[50px]">
                      <div className="text-2xl font-extrabold text-slate-800 leading-none">{c.order_count}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Order</div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: c.stars }).map((_, i) => (
                          <Star key={i} className="size-3.5 fill-amber-400" />
                        ))}
                      </div>
                      {c.customer_id ? (
                        <Link
                          to="/customers/$id"
                          params={{ id: c.customer_id }}
                          className="font-bold text-sm text-slate-800 hover:text-primary truncate block hover:underline"
                        >
                          {c.name}
                        </Link>
                      ) : (
                        <div className="font-bold text-sm text-slate-800 truncate">{c.name}</div>
                      )}
                      {c.role && c.role !== "Pelanggan" && (
                        <div className="text-xs italic text-slate-600 font-medium">{c.role}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider truncate">
                        {c.city}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t text-center bg-slate-50/30">
              <Link to="/customers" className="text-xs text-muted-foreground hover:text-primary font-medium">
                View All
              </Link>
            </div>
          </Card>

          {/* CARD 3: CUSTOMER LOCATION */}
          <Card className="p-0 overflow-hidden border shadow-sm">
            <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2">
              <MapPin className="size-4 text-slate-500" />
              <h2 className="font-bold text-sm text-slate-700">Customer Location</h2>
            </div>

            <div className="divide-y max-h-[500px] overflow-y-auto">
              {customerLocations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  Belum ada data lokasi pengiriman di periode ini
                </div>
              ) : (
                customerLocations.map((loc) => (
                  <div key={loc.rank} className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="text-3xl font-extrabold text-slate-300 leading-none shrink-0 w-8">
                      {loc.rank}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="font-bold text-sm text-slate-800 truncate">{loc.location}</div>
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border border-emerald-500 text-emerald-700 bg-emerald-50">
                          {loc.order_count} Order ({loc.percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t text-center bg-slate-50/30">
              <Link to="/shipping" className="text-xs text-muted-foreground hover:text-primary font-medium">
                View All
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
