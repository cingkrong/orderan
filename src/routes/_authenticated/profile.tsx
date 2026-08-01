import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getUserProfile, updateUserProfile } from "@/lib/profile.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIDR } from "@/lib/format";
import {
  User,
  Mail,
  Phone,
  Shield,
  Building,
  MapPin,
  Calendar,
  Wallet,
  ShoppingBag,
  Zap,
  Save,
  CheckCircle2,
  AlertCircle,
  Key,
  Settings as SettingsIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const fetchProfile = useServerFn(getUserProfile);
  const updateProfile = useServerFn(updateUserProfile);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => fetchProfile(),
  });

  const [fullName, setFullName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderCity, setSenderCity] = useState("");
  const [senderAddress, setSenderAddress] = useState("");

  useEffect(() => {
    if (data) {
      setFullName(data.fullName || "");
      setSenderName(data.settings?.sender_name || "");
      setSenderPhone(data.settings?.sender_phone || "");
      setSenderCity(data.settings?.sender_city || "");
      setSenderAddress(data.settings?.sender_address || "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProfile({
        data: {
          fullName,
          senderName,
          senderPhone,
          senderCity,
          senderAddress,
        },
      }),
    onSuccess: () => {
      toast.success("Profil pengguna berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui profil");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const user = data;
  const lincahUser = user?.lincahProfile?.user;
  const lincahBalance = user?.lincahProfile?.balance ?? 0;
  const isLincahConnected = Boolean(user?.lincahProfile);

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER PAGE TITLE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Profil Pengguna</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Informasi lengkap akun pengguna, identitas toko, dan integrasi API
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-4 mr-2" /> Refresh
          </Button>
          <Button size="sm" asChild>
            <Link to="/settings">
              <SettingsIcon className="size-4 mr-2" /> Pengaturan Sistem
            </Link>
          </Button>
        </div>
      </div>

      {/* USER HERO PROFILE CARD */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 via-background to-accent/20 border">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="relative">
            <div className="size-20 md:size-24 rounded-full bg-primary text-primary-foreground font-bold text-3xl grid place-items-center shadow-lg border-2 border-background">
              {fullName.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-500 text-white border-2 border-background">
              <CheckCircle2 className="size-4" />
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold">{fullName || "Nama Pengguna"}</h2>
              <Badge variant="default" className="capitalize">
                <Shield className="size-3 mr-1" />
                {user?.role || "Administrator"}
              </Badge>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                Aktif / Terverifikasi
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-primary" />
                <span className="truncate">{user?.email}</span>
              </div>
              {senderPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-primary" />
                  <span>{senderPhone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                <span>
                  Bergabung:{" "}
                  {user?.createdAt
                    ? format(new Date(user.createdAt), "d MMM yyyy", { locale: idLocale })
                    : "—"}
                </span>
              </div>
            </div>

            <div className="text-xs font-mono text-muted-foreground pt-1">
              User ID: <span className="text-foreground">{user?.userId}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* STATS METRIC SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Pesanan Sistem</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">{user?.stats?.totalOrders ?? 0}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
            <Wallet className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Omset Penjualan</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">
              {formatIDR(user?.stats?.totalRevenue ?? 0)}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
            <Zap className="size-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Saldo Deposit Lincah.id</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5">
              {isLincahConnected ? formatIDR(lincahBalance) : "Belum Konek"}
            </div>
          </div>
        </Card>
      </div>

      {/* EDIT PROFILE & STORE INFORMATION FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PERSONAL DETAILS CARD */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <User className="size-5 text-primary" />
            <h3 className="font-bold text-lg">Informasi Pribadi Akun</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">
                Nama Lengkap Pengguna<span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama Pengguna"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Alamat Email (Login)</Label>
              <Input className="mt-1 bg-muted/50" value={user?.email || ""} disabled readOnly />
              <p className="text-[11px] text-muted-foreground mt-1">
                Email akun dikelola melalui kredensial autentikasi sistem.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Role / Hak Akses</Label>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="px-3 py-1 text-xs capitalize">
                  <Shield className="size-3 mr-1 text-primary" />
                  {user?.role || "Administrator"}
                </Badge>
                <span className="text-xs text-muted-foreground">Akses Penuh Pengelolaan OMS</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">ID Pengguna Sistem (UUID)</Label>
              <Input
                className="mt-1 font-mono text-xs bg-muted/50"
                value={user?.userId || ""}
                disabled
                readOnly
              />
            </div>
          </div>
        </Card>

        {/* STORE & SENDER ORIGIN DETAILS CARD */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Building className="size-5 text-primary" />
            <h3 className="font-bold text-lg">Profil Toko & Pengirim</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">Nama Toko / Pengirim Default</Label>
              <Input
                className="mt-1"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="cth. Gudang Utama Maularis"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Nomor Telepon Pengirim</Label>
              <Input
                className="mt-1"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                placeholder="081234567890"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Kota Asal Pengirim</Label>
              <Input
                className="mt-1"
                value={senderCity}
                onChange={(e) => setSenderCity(e.target.value)}
                placeholder="Surakarta"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Alamat Lengkap Pengirim / Gudang</Label>
              <Textarea
                rows={2}
                className="mt-1 text-xs"
                value={senderAddress}
                onChange={(e) => setSenderAddress(e.target.value)}
                placeholder="Alamat fisik pengiriman..."
              />
            </div>
          </div>
        </Card>
      </div>

      {/* SAVE BUTTON BAR */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !fullName}
        >
          <Save className="size-4 mr-2" />
          {saveMutation.isPending ? "Menyimpan Profil..." : "Simpan Perubahan Profil"}
        </Button>
      </div>

      {/* LINCAH.ID INTEGRATION PROFILE CARD */}
      <Card className="p-6 space-y-4 border-l-4 border-l-primary">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-amber-500" />
            <h3 className="font-bold text-lg">Profil Integrasi Akun Lincah.id</h3>
          </div>
          <Badge
            variant={isLincahConnected ? "default" : "destructive"}
            className="self-start sm:self-auto"
          >
            {isLincahConnected ? "Terhubung" : "Belum Terhubung"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
            <div className="text-xs text-muted-foreground">Status Koneksi API</div>
            <div className="font-semibold flex items-center gap-1.5">
              {isLincahConnected ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-emerald-700">Online / Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-4 text-destructive" />
                  <span className="text-destructive">Tidak Terhubung</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
            <div className="text-xs text-muted-foreground">Partner ID</div>
            <div className="font-mono font-semibold truncate">
              {user?.settings?.lincah_partner_id || "6a4617ceb8fd8dd8aa41906e"}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
            <div className="text-xs text-muted-foreground">Lingkungan (Environment)</div>
            <div className="font-semibold capitalize">
              {user?.settings?.lincah_env || "development"}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
            <div className="text-xs text-muted-foreground">Saldo Deposit Akun</div>
            <div className="font-bold text-emerald-600">
              {isLincahConnected ? formatIDR(lincahBalance) : "—"}
            </div>
          </div>
        </div>

        {lincahUser && (
          <div className="mt-4 p-4 rounded-lg bg-accent/30 border text-xs space-y-2">
            <div className="font-semibold text-sm text-primary mb-1">
              Data Akun Lincah Terhubung:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-muted-foreground">Nama Akun: </span>
                <span className="font-medium">{lincahUser.name || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{lincahUser.email || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">No. Telepon: </span>
                <span className="font-medium">{lincahUser.phone || "—"}</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
