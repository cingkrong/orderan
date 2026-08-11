import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getShippingCost, searchDestinations } from "@/lib/shipping.functions";
import { CourierLogo } from "@/components/courier-logo";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Calculator,
  Truck,
  Search,
  RefreshCw,
  MapPin,
  Clock,
  Sparkles,
  Plus,
  Tag,
  ArrowUpDown,
  Check,
  Building2,
  Info,
  ChevronRight,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cek-ongkir")({
  component: CekOngkirPage,
});

type SortOption = "cheapest" | "fastest" | "highest_discount";

function CekOngkirPage() {
  const navigate = useNavigate();
  const getRates = useServerFn(getShippingCost);
  const searchDest = useServerFn(searchDestinations);

  const [destQ, setDestQ] = useState("");
  const [selectedDest, setSelectedDest] = useState<{
    id: string;
    label: string;
    district_name?: string;
    city_name?: string;
    zip_code?: string;
  } | null>(null);

  const [weightG, setWeightG] = useState<number>(1000);
  const [isCod, setIsCod] = useState(false);
  const [itemValue, setItemValue] = useState<number>(100000);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // Filter & Sort States
  const [selectedCourierFilter, setSelectedCourierFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("cheapest");

  const destResults = useQuery({
    queryKey: ["cek-ongkir-page-dest", destQ],
    queryFn: () => searchDest({ data: { q: destQ, limit: 10 } }),
    enabled: destQ.trim().length >= 3 && !selectedDest,
  });

  async function handleCheckOngkir(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedDest) {
      toast.error("Pilih lokasi kecamatan/kota tujuan terlebih dahulu");
      return;
    }
    setCalculating(true);
    try {
      const res = await getRates({
        data: {
          destination_subdistrict_id: selectedDest.id,
          dest_kecamatan: selectedDest.district_name || "",
          dest_kota: selectedDest.city_name || "",
          dest_zip: selectedDest.zip_code || "",
          weight_g: Number(weightG),
          is_cod: isCod,
          item_value: Number(itemValue),
          force_refresh: true,
        },
      });
      const dataList = res || [];
      setResults(dataList);
      if (dataList.length === 0) {
        toast.warning("Tidak ada opsi ongkir yang ditemukan untuk lokasi ini.");
      } else {
        toast.success(`Berhasil memuat ${dataList.length} opsi pengiriman Lincah.id!`);
      }
    } catch (err) {
      toast.error(`Gagal menghitung ongkir: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCalculating(false);
    }
  }

  // Unique Couriers for Filter
  const availableCouriers = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => {
      const c = r.courier_code || r.courier_name;
      if (c) set.add(c.toLowerCase());
    });
    return Array.from(set);
  }, [results]);

  // Filtered & Sorted Results
  const processedResults = useMemo(() => {
    let filtered = [...results];

    if (selectedCourierFilter !== "all") {
      filtered = filtered.filter((r) => {
        const c = (r.courier_code || r.courier_name || "").toLowerCase();
        return c.includes(selectedCourierFilter);
      });
    }

    filtered.sort((a, b) => {
      if (sortBy === "cheapest") {
        return (a.value || 0) - (b.value || 0);
      }
      if (sortBy === "highest_discount") {
        return (b.discount_percent || 0) - (a.discount_percent || 0);
      }
      if (sortBy === "fastest") {
        const getEtdMin = (etdStr?: string) => {
          if (!etdStr) return 999;
          const match = etdStr.match(/\d+/);
          return match ? parseInt(match[0], 10) : 999;
        };
        return getEtdMin(a.etd) - getEtdMin(b.etd);
      }
      return 0;
    });

    return filtered;
  }, [results, selectedCourierFilter, sortBy]);

  const handleUseRateInNewOrder = (rate: any) => {
    const courierCode = rate.courier_code || rate.courier_name || "lincah";
    const serviceName = rate.service || "REG";
    const costValue = rate.value || 0;

    navigate({
      to: "/orders/new",
      search: {
        dest_id: selectedDest?.id,
        dest_label: selectedDest?.label,
        weight: weightG,
        courier: `lincah:${courierCode}`,
        service: serviceName,
        shipping_cost: costValue,
        is_cod: isCod,
      } as any,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Calculator className="size-6" />
            </div>
            Kalkulator Cek Ongkir Real-Time
          </h1>
          <p className="text-sm text-muted-foreground pl-1">
            Hitung & bandingkan tarif pengiriman resmi, diskon spesial Lincah.id, dan estimasi waktu tiba dari berbagai ekspedisi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <Link to="/settings">
              <Building2 className="size-3.5" /> Pengaturan Asal & Diskon
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Form Card */}
      <Card className="p-6 shadow-sm border-emerald-500/20 bg-gradient-to-br from-card via-card to-emerald-500/5">
        <form onSubmit={handleCheckOngkir} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            {/* Destination Search */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="size-3.5 text-emerald-600" />
                Lokasi Tujuan (Kecamatan / Kota / Kode Pos) *
              </Label>
              {selectedDest ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3.5 py-2.5 shadow-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Check className="size-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold truncate">{selectedDest.label}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                      setSelectedDest(null);
                      setDestQ("");
                    }}
                  >
                    Ganti
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Ketik minimal 3 huruf nama kecamatan atau kota..."
                    value={destQ}
                    onChange={(e) => setDestQ(e.target.value)}
                    className="pl-9 h-10 text-xs shadow-xs"
                    autoFocus
                  />
                  {destQ.trim().length >= 3 && destResults.data && destResults.data.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-60 overflow-auto rounded-xl border bg-popover p-1.5 shadow-xl">
                      {destResults.data.map((d: any) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setSelectedDest({
                              id: d.id,
                              label: d.label,
                              district_name: d.district_name,
                              city_name: d.city_name,
                              zip_code: d.zip_code,
                            });
                            setDestQ("");
                          }}
                          className="w-full text-left p-2.5 text-xs hover:bg-accent rounded-lg flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="font-medium truncate">{d.label}</div>
                          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Weight & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Truck className="size-3.5 text-emerald-600" />
                  Berat Paket (Gram) *
                </Label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {(weightG / 1000).toFixed(1)} kg
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={weightG}
                  onChange={(e) => setWeightG(Number(e.target.value))}
                  className="h-10 text-xs font-mono shadow-xs flex-1"
                  placeholder="1000"
                />
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-medium text-muted-foreground mr-1">Preset:</span>
                {[500, 1000, 2000, 3000, 5000].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeightG(w)}
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors",
                      weightG === w
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 font-bold"
                        : "bg-muted/40 hover:bg-accent text-muted-foreground",
                    )}
                  >
                    {w >= 1000 ? `${w / 1000}kg` : `${w}g`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* COD & Value Settings */}
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card shadow-xs">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Metode Cash on Delivery (COD)
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Simulasikan biaya penanganan COD Lincah.id
                </div>
              </div>
              <input
                type="checkbox"
                checked={isCod}
                onChange={(e) => setIsCod(e.target.checked)}
                className="size-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {isCod && (
              <div className="space-y-1.5 p-3 rounded-xl border bg-card shadow-xs animate-in fade-in duration-200">
                <Label className="text-xs font-semibold">Estimasi Nilai Barang (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  step={5000}
                  value={itemValue}
                  onChange={(e) => setItemValue(Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                  placeholder="100000"
                />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={calculating || !selectedDest}
              className="h-11 px-8 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all gap-2 w-full sm:w-auto"
            >
              {calculating ? (
                <>
                  <RefreshCw className="size-4 animate-spin" /> Menghitung Ongkir Real-Time...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Hitung Ongkir Lincah.id
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Filter, Sort & Results Section */}
      {results.length > 0 && (
        <div className="space-y-4 pt-4 animate-in slide-in-from-bottom-2 duration-300">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card shadow-xs">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-emerald-600" />
              <span className="font-bold text-sm">
                Opsi Pengiriman Ditemukan ({processedResults.length} dari {results.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {/* Courier Filter */}
              {availableCouriers.length > 1 && (
                <div className="flex items-center gap-1 text-xs">
                  <Filter className="size-3.5 text-muted-foreground" />
                  <select
                    value={selectedCourierFilter}
                    onChange={(e) => setSelectedCourierFilter(e.target.value)}
                    className="h-8 px-2 rounded-md border text-xs bg-background focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">Semua Kurir</option>
                    {availableCouriers.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort By */}
              <div className="flex items-center gap-1 text-xs">
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-8 px-2 rounded-md border text-xs bg-background focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="cheapest">Termurah</option>
                  <option value="fastest">Tercepat (ETD)</option>
                  <option value="highest_discount">Diskon Tertinggi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {processedResults.map((r: any, idx: number) => {
              const hasDiscount = Boolean(r.discount_percent && r.discount_percent > 0);
              const courierCode = r.courier_code || r.courier_name || "kurir";
              const savings = hasDiscount && r.original_value ? r.original_value - r.value : 0;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border bg-card shadow-xs hover:shadow-md hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-3 relative group"
                >
                  {/* Top Courier Header */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <CourierLogo courier={courierCode} size="md" />
                      {r.etd ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono px-2 py-0.5 bg-muted/50 border-border/80 flex items-center gap-1"
                        >
                          <Clock className="size-3 text-muted-foreground" />
                          {r.etd} hari
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                          Reguler
                        </Badge>
                      )}
                    </div>

                    <div className="pt-1">
                      <div className="font-bold text-sm uppercase tracking-wide text-foreground">
                        {r.courier_name || courierCode} — <span className="text-emerald-600">{r.service}</span>
                      </div>
                      {r.special_terms && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1" title={r.special_terms}>
                          {r.special_terms}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="space-y-1 pt-2 border-t border-border/60">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold text-foreground">
                          Rp {Number(r.value || 0).toLocaleString("id-ID")}
                        </span>
                        {hasDiscount && r.original_value && (
                          <span className="text-xs line-through text-muted-foreground">
                            Rp {Number(r.original_value).toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                      {hasDiscount && (
                        <Badge className="bg-emerald-500 text-white font-bold text-[10px] px-1.5 py-0.5">
                          {r.discount_percent}% OFF
                        </Badge>
                      )}
                    </div>

                    {savings > 0 && (
                      <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Sparkles className="size-3" />
                        Hemat Rp {savings.toLocaleString("id-ID")} dengan Lincah.id
                      </div>
                    )}
                  </div>

                  {/* Quick Action */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full text-xs font-semibold border-emerald-500/30 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all gap-1.5 mt-2"
                    onClick={() => handleUseRateInNewOrder(r)}
                  >
                    <Plus className="size-3.5" /> Gunakan di Orderan Baru
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty / Intro Info Banner */}
      {results.length === 0 && !calculating && (
        <Card className="p-8 text-center space-y-3 bg-muted/20 border-dashed">
          <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto">
            <Info className="size-6" />
          </div>
          <h3 className="font-semibold text-base">Pilih Tujuan & Masukkan Berat Paket</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Ketik lokasi kecamatan atau kota tujuan di formulir atas, lalu klik <strong>Hitung Ongkir Lincah.id</strong> untuk membandingkan tarif ekspedisi secara instan.
          </p>
        </Card>
      )}
    </div>
  );
}
