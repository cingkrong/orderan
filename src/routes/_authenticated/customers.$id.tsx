import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getCustomer, updateCustomerDetails } from "@/lib/customers.functions";
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

  const lastOrderDate = orders[0]?.created_at
    ? new Date(orders[0].created_at)
    : c.created_at
      ? new Date(c.created_at)
      : null;

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER & QUICK ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/customers">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-primary text-primary-foreground font-bold text-xl grid place-items-center shadow-sm">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{c.name}</h1>
                <Badge variant="outline" className={cn("text-xs font-semibold", tier.color)}>
                  <Award className="size-3 mr-1" />
                  {tier.label}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm font-mono mt-0.5">{c.phone}</p>
            </div>
          </div>
        </div>

        {/* QUICK CRM ACTIONS */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
            asChild
          >
            <a
              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Halo Kak ${c.name}, terima kasih sudah berbelanja di toko kami!`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageSquare className="size-4 mr-1.5" /> WhatsApp
            </a>
          </Button>

          <Button variant="outline" asChild>
            <a href={`tel:${c.phone}`}>
              <Phone className="size-4 mr-1.5" /> Hubungi
            </a>
          </Button>

          <Button variant="secondary" onClick={copyAddressToClipboard}>
            <Copy className="size-4 mr-1.5" /> Salin Alamat
          </Button>

          <Button asChild>
            <Link to="/orders/new">
              <Plus className="size-4 mr-1.5" /> Buat Order Baru
            </Link>
          </Button>
        </div>
      </div>

      {/* CRM METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Pesanan</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">{totalOrders}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
            <TrendingUp className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Lifetime Value (LTV)</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">{formatIDR(totalSpent)}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
            <Award className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Rata-Rata Order (AOV)</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">{formatIDR(aov)}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
            <Clock className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Order Terakhir</div>
            <div className="text-sm font-semibold mt-1">
              {lastOrderDate
                ? formatDistanceToNow(lastOrderDate, { addSuffix: true, locale: idLocale })
                : "—"}
            </div>
          </div>
        </Card>
      </div>

      {/* CRM TABS SECTION */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md">
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Kecamatan</Label>
                    <Input
                      className="mt-1 text-xs"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Kota / Kabupaten</Label>
                    <Input
                      className="mt-1 text-xs"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
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
