import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getCustomer, updateCustomerDetails } from "@/lib/customers.functions";
import { searchDestinations, Destination } from "@/lib/shipping.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatIDR, STATUS_LABEL, STATUS_TONE, COURIER_LABEL } from "@/lib/format";
import {
  ArrowLeft,
  X,
  Plus,
  Save,
  Phone,
  MessageSquare,
  Copy,
  ShoppingBag,
  TrendingUp,
  Award,
  Calendar,
  MapPin,
  Tag,
  FileText,
  Clock,
  ChevronRight,
  UserCheck,
  Truck,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  component: CustomerDetailPage,
});

const QUICK_TAG_SUGGESTIONS = [
  "VIP",
  "Dropshipper",
  "Reseller",
  "Grosir",
  "Pelanggan Setia",
  "Prioritas",
  "Cepat Bayar",
];

function formatWaPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  return cleaned;
}

function getLoyaltyTier(totalSpent: number, totalOrders: number) {
  if (totalSpent >= 2000000 || totalOrders >= 10) {
    return { label: "VIP Platinum", color: "bg-purple-100 text-purple-700 border-purple-300" };
  }
  if (totalSpent >= 1000000 || totalOrders >= 5) {
    return { label: "Gold Member", color: "bg-amber-100 text-amber-700 border-amber-300" };
  }
  if (totalOrders >= 2) {
    return { label: "Repeat Buyer", color: "bg-blue-100 text-blue-700 border-blue-300" };
  }
  return { label: "Pelanggan Baru", color: "bg-emerald-100 text-emerald-700 border-emerald-300" };
}

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOne = useServerFn(getCustomer);
  const updateCustomerFn = useServerFn(updateCustomerDetails);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");

  const [fullAddress, setFullAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [destinationSubdistrictId, setDestinationSubdistrictId] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [cityQ, setCityQ] = useState("");
  const [showKecamatanSearch, setShowKecamatanSearch] = useState(false);

  const searchDestFn = useServerFn(searchDestinations);
  const citiesQuery = useQuery({
    queryKey: ["destinations-search", cityQ],
    queryFn: () => searchDestFn({ data: { q: cityQ } }),
    enabled: cityQ.trim().length >= 3,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.customer) {
      const c = data.customer;
      setName(c.name || "");
      setPhone(c.phone || "");
      setTags(c.tags ?? []);
      setNotes(c.notes ?? "");

      const addr = (c.last_address as Record<string, any> | null) ?? null;
      if (addr) {
        setFullAddress(addr.full_address ?? "");
        setDistrict(addr.district ?? "");
        setCity(addr.city ?? "");
        setProvince(addr.province ?? "");
        setPostalCode(addr.postal_code ?? "");
        setDestinationSubdistrictId(addr.destination_subdistrict_id ?? "");
        setDestinationLabel(addr.destination_label ?? "");
      }
    }
  }, [data?.customer]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const updatedAddress = {
        full_address: fullAddress,
        district,
        city,
        province,
        postal_code: postalCode,
        destination_subdistrict_id: destinationSubdistrictId,
        destination_label: destinationLabel,
      };
      return updateCustomerFn({
        data: {
          id,
          name,
          phone,
          tags,
          notes: notes || null,
          last_address: updatedAddress,
        },
      });
    },
    onSuccess: () => {
      toast.success("Data CRM pelanggan berhasil disimpan");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addTag(tagToAdd?: string) {
    const t = (tagToAdd || tagInput).trim();
    if (!t || tags.includes(t)) {
      setTagInput("");
      return;
    }
    setTags([...tags, t]);
    setTagInput("");
  }

  function copyAddressToClipboard() {
    const c = data?.customer;
    if (!c) return;
    const addr = (c.last_address as Record<string, any> | null) ?? null;
    const text = [
      `Penerima: ${c.name}`,
      `No. HP: ${c.phone}`,
      `Alamat: ${addr?.full_address || fullAddress || "-"}`,
      addr?.district ? `Kecamatan: ${addr.district}` : null,
      addr?.city ? `Kota/Kab: ${addr.city}` : null,
      addr?.province ? `Provinsi: ${addr.province}` : null,
      addr?.postal_code ? `Kode Pos: ${addr.postal_code}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text);
    toast.success("Alamat lengkap berhasil disalin ke clipboard!");
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/customers">
            <ArrowLeft className="size-4 mr-1" /> Kembali ke Pelanggan
          </Link>
        </Button>
        <Card className="p-10 text-center text-muted-foreground">Pelanggan tidak ditemukan</Card>
      </div>
    );
  }

  const c = data.customer;
  const orders = data.orders ?? [];
  const totalSpent = Number(c.total_spent || 0);
  const totalOrders = Number(c.total_orders || 0);
  const aov = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;
  const tier = getLoyaltyTier(totalSpent, totalOrders);
  const waPhone = formatWaPhone(c.phone);

  const isDs = tags.some((t) => t.toLowerCase().includes("dropship"));
  const isReseller = tags.some((t) => t.toLowerCase().includes("reseller"));
  const isGrosir = tags.some((t) => t.toLowerCase().includes("grosir"));
  const isPenerima = tags.some((t) => t.toLowerCase().includes("penerima"));

  const customerTypeLabel = isDs
    ? "📦 Dropshipper"
    : isReseller
      ? "🏪 Reseller"
      : isGrosir
        ? "🛍️ Pembeli Grosir"
        : isPenerima
          ? "📍 Penerima Pengiriman"
          : "👤 Pelanggan Retail";

  const customerTypeBadgeColor = isDs
    ? "bg-blue-100 text-blue-700 border-blue-300"
    : isReseller
      ? "bg-amber-100 text-amber-700 border-amber-300"
      : isGrosir
        ? "bg-purple-100 text-purple-700 border-purple-300"
        : "bg-emerald-100 text-emerald-700 border-emerald-300";

  const waMessage = isDs
    ? `Halo Kak ${c.name}, berikut update data transaksi & pesanan dropship Anda di toko kami!`
    : isReseller
      ? `Halo Kak ${c.name}, berikut update katalog & order reseller Anda!`
      : `Halo Kak ${c.name}, terima kasih sudah berbelanja di toko kami!`;

  const lastOrderDate = orders[0]?.created_at
    ? new Date(orders[0].created_at)
    : c.created_at
      ? new Date(c.created_at)
      : null;

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER & QUICK ACTIONS */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 mt-1" asChild>
            <Link to="/customers">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="size-12 md:size-14 rounded-full bg-primary text-primary-foreground font-bold text-lg md:text-xl grid place-items-center shadow-sm shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight truncate">{c.name}</h1>
                  <Badge variant="outline" className={cn("text-[10px] md:text-xs font-semibold px-2 py-0.5 shrink-0", customerTypeBadgeColor)}>
                    {customerTypeLabel}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className={cn("text-[10px] font-semibold px-2 py-0.5", tier.color)}>
                    <Award className="size-3 mr-1" />
                    {tier.label}
                  </Badge>
                  <span className="text-muted-foreground text-xs md:text-sm font-mono">{c.phone}</span>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-2 py-0">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* QUICK CRM ACTIONS */}
        <div className="flex flex-wrap items-center gap-2 pl-11 md:pl-12">
          <Button
            variant="outline"
            size="sm"
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 text-xs"
            asChild
          >
            <a
              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageSquare className="size-3.5 mr-1" /> WhatsApp
            </a>
          </Button>

          <Button variant="outline" size="sm" className="text-xs" asChild>
            <a href={`tel:${c.phone}`}>
              <Phone className="size-3.5 mr-1" /> Hubungi
            </a>
          </Button>

          <Button variant="secondary" size="sm" className="text-xs" onClick={copyAddressToClipboard}>
            <Copy className="size-3.5 mr-1" /> Salin Alamat
          </Button>

          <Button size="sm" className="text-xs" asChild>
            <Link to="/orders/new">
              <Plus className="size-3.5 mr-1" /> Buat Order Baru
            </Link>
          </Button>
        </div>
      </div>

      {/* CRM METRICS CARDS */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-3 md:p-4 flex items-center gap-3">
          <div className="p-2.5 md:p-3 rounded-xl bg-primary/10 text-primary shrink-0">
            <ShoppingBag className="size-5 md:size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] md:text-xs text-muted-foreground font-medium">Total Pesanan</div>
            <div className="text-lg md:text-2xl font-bold tabular-nums mt-0.5">{totalOrders}</div>
          </div>
        </Card>

        <Card className="p-3 md:p-4 flex items-center gap-3">
          <div className="p-2.5 md:p-3 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
            <TrendingUp className="size-5 md:size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] md:text-xs text-muted-foreground font-medium">LTV</div>
            <div className="text-base md:text-xl xl:text-2xl font-bold tabular-nums mt-0.5 truncate">{formatIDR(totalSpent)}</div>
          </div>
        </Card>

        <Card className="p-3 md:p-4 flex items-center gap-3">
          <div className="p-2.5 md:p-3 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
            <Award className="size-5 md:size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] md:text-xs text-muted-foreground font-medium">AOV</div>
            <div className="text-base md:text-xl xl:text-2xl font-bold tabular-nums mt-0.5 truncate">{formatIDR(aov)}</div>
          </div>
        </Card>

        <Card className="p-3 md:p-4 flex items-center gap-3">
          <div className="p-2.5 md:p-3 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
            <Clock className="size-5 md:size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] md:text-xs text-muted-foreground font-medium">Order Terakhir</div>
            <div className="text-xs md:text-sm font-semibold mt-1 truncate">
              {lastOrderDate
                ? formatDistanceToNow(lastOrderDate, { addSuffix: true, locale: idLocale })
                : "—"}
            </div>
          </div>
        </Card>
      </div>

      {/* CRM TABS SECTION */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="profile">Profil & Alamat</TabsTrigger>
          <TabsTrigger value="crm">Tag & Catatan CRM</TabsTrigger>
          <TabsTrigger value="orders">Riwayat Order ({orders.length})</TabsTrigger>
        </TabsList>

        {/* TAB 1: PROFIL & ALAMAT */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <UserCheck className="size-5 text-primary" />
                <h3 className="font-bold text-lg">Informasi Kontak</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold">Nama Lengkap Pelanggan</Label>
                  <Input
                    className="mt-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Nomor Telepon / WhatsApp</Label>
                  <Input
                    className="mt-1 font-mono"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Tanggal Pertama Bergabung</Label>
                  <Input
                    className="mt-1 bg-muted/50 text-xs"
                    value={
                      c.created_at
                        ? format(new Date(c.created_at), "d MMMM yyyy, HH:mm", { locale: idLocale })
                        : "—"
                    }
                    disabled
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="size-5 text-primary" />
                  <h3 className="font-bold text-lg">Alamat Utama Pengiriman</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={copyAddressToClipboard}>
                  <Copy className="size-3.5 mr-1" /> Salin
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold">Alamat Lengkap (Jalan, No. Rumah, RT/RW)</Label>
                  <Textarea
                    rows={3}
                    className="mt-1 text-xs"
                    value={fullAddress}
                    onChange={(e) => setFullAddress(e.target.value)}
                    placeholder="Alamat lengkap pengiriman..."
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold block mb-1">
                    Kecamatan Pengiriman / Wilayah Lincah API
                  </Label>
                  {destinationSubdistrictId || destinationLabel || district ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border p-3 bg-muted/20 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">
                          {destinationLabel || `${district}, ${city}, ${province} ${postalCode}`}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Kecamatan: <span className="font-medium text-foreground">{district || "—"}</span>
                          {destinationSubdistrictId && (
                            <span className="ml-2 px-1.5 py-0.2 rounded bg-muted font-mono text-[10px]">
                              ID: {destinationSubdistrictId}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs shrink-0"
                        onClick={() => {
                          setShowKecamatanSearch(true);
                          setCityQ(district || "");
                        }}
                      >
                        Ganti Kecamatan
                      </Button>
                    </div>
                  ) : null}

                  {(!destinationSubdistrictId && !destinationLabel && !district) || showKecamatanSearch ? (
                    <div className="mt-2 space-y-2 rounded-lg border p-3 bg-background shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-[11px] font-semibold text-primary">Cari Kecamatan (Ketik min. 3 huruf)</Label>
                        {showKecamatanSearch && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={() => setShowKecamatanSearch(false)}
                          >
                            Batal
                          </Button>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          placeholder="Ketikan nama kecamatan, cth: Banjarsari..."
                          value={cityQ}
                          onChange={(e) => setCityQ(e.target.value)}
                          className="text-xs pr-8"
                        />
                        {citiesQuery.isFetching ? (
                          <Loader2 className="size-4 animate-spin text-primary absolute right-2.5 top-1/2 -translate-y-1/2" />
                        ) : (
                          <Search className="size-4 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
                        )}
                      </div>

                      {cityQ.trim().length >= 3 && (
                        <div className="max-h-48 overflow-y-auto border rounded-md divide-y bg-popover">
                          {citiesQuery.isFetching && (
                            <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                              <Loader2 className="size-3.5 animate-spin text-primary" />
                              Mencari wilayah kecamatan...
                            </div>
                          )}
                          {!citiesQuery.isFetching && (citiesQuery.data ?? []).length === 0 && (
                            <div className="p-3 text-xs text-muted-foreground text-center">
                              Kecamatan tidak ditemukan. Coba ketik nama lain.
                            </div>
                          )}
                          {!citiesQuery.isFetching &&
                            (citiesQuery.data ?? []).map((c: Destination) => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left p-2.5 hover:bg-accent text-xs transition-colors flex flex-col gap-0.5"
                                onClick={() => {
                                  setDistrict(c.subdistrict_name || c.district_name);
                                  setCity(c.city_name);
                                  setProvince(c.province_name);
                                  setPostalCode(c.zip_code);
                                  setDestinationSubdistrictId(c.id);
                                  setDestinationLabel(c.label);
                                  setShowKecamatanSearch(false);
                                  setCityQ("");
                                  toast.success(`Kecamatan "${c.subdistrict_name || c.district_name}" dipilih`);
                                }}
                              >
                                <div className="font-semibold text-foreground">{c.label}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  ID: {c.id} · Kode Pos: {c.zip_code || "—"}
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Nama Kecamatan</Label>
                    <Input
                      className="mt-1 text-xs"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="cth. Banjarsari"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Kota / Kabupaten</Label>
                    <Input
                      className="mt-1 text-xs"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="cth. Surakarta"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Provinsi</Label>
                    <Input
                      className="mt-1 text-xs"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Kode Pos</Label>
                    <Input
                      className="mt-1 text-xs font-mono"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="size-4 mr-2" />
              {saveMutation.isPending ? "Menyimpan Data..." : "Simpan Perubahan CRM"}
            </Button>
          </div>
        </TabsContent>

        {/* TAB 2: CRM TAGS & NOTES */}
        <TabsContent value="crm" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TAGS SECTION */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <Tag className="size-5 text-primary" />
                <h3 className="font-bold text-lg">Label & Segmentasi Pelanggan</h3>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground block mb-2">
                  Label Tersimpan
                </Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.length === 0 && (
                    <span className="text-xs text-muted-foreground">Belum ada tag/label</span>
                  )}
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      variant={
                        t.toLowerCase().includes("vip")
                          ? "default"
                          : t.toLowerCase().includes("dropship")
                            ? "secondary"
                            : "outline"
                      }
                      className="gap-1 px-3 py-1 text-xs"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                        className="hover:text-destructive ml-1"
                        aria-label={`Hapus ${t}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                <Label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Rekomendasi Tag Cepat:
                </Label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {QUICK_TAG_SUGGESTIONS.map((st) => (
                    <Button
                      key={st}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs bg-muted/40 hover:bg-primary/10 hover:text-primary"
                      onClick={() => addTag(st)}
                    >
                      + {st}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Tambah tag kustom lalu simpan..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => addTag()}>
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* NOTES SECTION */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <FileText className="size-5 text-primary" />
                <h3 className="font-bold text-lg">Catatan CRM Internal</h3>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Catatan Khusus Pelanggan
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  placeholder="Tuliskan preferensi produk pelanggan, riwayat komplain, instruksi pengiriman khusus, atau catatan penting lainnya..."
                  className="text-xs"
                />
              </div>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="size-4 mr-2" />
              {saveMutation.isPending ? "Menyimpan Catatan..." : "Simpan Tag & Catatan CRM"}
            </Button>
          </div>
        </TabsContent>

        {/* TAB 3: ORDER HISTORY TIMELINE */}
        <TabsContent value="orders">
          <Card className="overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-base">Riwayat Belanja & Orderan ({orders.length})</h3>
              <Button size="sm" asChild>
                <Link to="/orders/new">
                  <Plus className="size-4 mr-1" /> Order Baru
                </Link>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">No. Pesanan</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Ekspedisi / No. Resi</th>
                    <th className="p-3 font-medium text-right">Total Transaksi</th>
                    <th className="p-3 font-medium">Tanggal</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-muted-foreground">
                        Belum ada riwayat pesanan untuk pelanggan ini
                      </td>
                    </tr>
                  ) : (
                    orders.map((o: any) => (
                      <tr
                        key={o.id}
                        className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigate({ to: "/orders/$id", params: { id: o.id } })}
                      >
                        <td className="p-3 font-mono text-xs font-semibold text-primary">
                          {o.order_number}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-xs font-medium",
                              STATUS_TONE[o.status],
                            )}
                          >
                            {STATUS_LABEL[o.status] ?? o.status}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          {o.courier ? (
                            <div>
                              <div className="font-medium">
                                {COURIER_LABEL[o.courier] ?? o.courier}
                              </div>
                              {o.tracking_number && (
                                <div className="text-muted-foreground font-mono">
                                  {o.tracking_number}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums font-semibold">
                          {formatIDR(o.total)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {format(new Date(o.created_at), "d MMM yyyy, HH:mm", {
                            locale: idLocale,
                          })}
                        </td>
                        <td className="p-3 text-right">
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </td>
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
