import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listCustomers, syncCustomersFromOrders, createCustomer } from "@/lib/customers.functions";
import { syncCustomersFromLincah } from "@/lib/lincah.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatIDR } from "@/lib/format";
import { Search, RefreshCw, Users, UserCheck, Truck, ShoppingBag, Plus, UserPlus, ChevronRight, CloudDownload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  const fetchAll = useServerFn(listCustomers);
  const syncFn = useServerFn(syncCustomersFromOrders);
  const syncLincahFn = useServerFn(syncCustomersFromLincah);
  const createFn = useServerFn(createCustomer);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["customers"], queryFn: () => fetchAll() });
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "regular" | "dropshipper" | "lincah">("all");
  const [openAddModal, setOpenAddModal] = useState(false);

  // Form state for creating customer
  const [newForm, setNewForm] = useState({
    name: "",
    phone: "",
    tagType: "Pelanggan",
    full_address: "",
    district: "",
    city: "",
    province: "",
    postal_code: "",
    notes: "",
  });

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

  const syncLincahMutation = useMutation({
    mutationFn: () => syncLincahFn(),
    onSuccess: (res) => {
      const total = (res.totalAddressFetched || 0) + (res.totalOrdersFetched || 0);
      toast.success(
        `Berhasil menyinkronkan ${res.uniqueCustomersCount || res.count} pelanggan unik dari total ${total} transaksi & alamat Lincah (${res.createdCount || 0} baru, ${res.updatedCount || 0} diperbarui)`
      );
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengambil data dari Lincah API");
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const tags = [newForm.tagType];
      return createFn({
        data: {
          name: newForm.name,
          phone: newForm.phone,
          tags,
          notes: newForm.notes || null,
          last_address: {
            full_address: newForm.full_address,
            district: newForm.district,
            city: newForm.city,
            province: newForm.province,
            postal_code: newForm.postal_code,
          },
        },
      });
    },
    onSuccess: (created) => {
      toast.success("Pelanggan baru berhasil ditambahkan!");
      setOpenAddModal(false);
      setNewForm({
        name: "",
        phone: "",
        tagType: "Pelanggan",
        full_address: "",
        district: "",
        city: "",
        province: "",
        postal_code: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (created?.id) {
        navigate({ to: "/customers/$id", params: { id: created.id } });
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menambah pelanggan");
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

  const isLincahCust = (c: any) =>
    Array.isArray(c.tags) && c.tags.some((t: string) => t.toLowerCase().includes("lincah"));

  const dropshipperList = allCustomers.filter(isDropshipper);
  const lincahList = allCustomers.filter(isLincahCust);
  const regularList = allCustomers.filter((c) => !isDropshipper(c));

  const currentTabList =
    activeTab === "dropshipper"
      ? dropshipperList
      : activeTab === "lincah"
        ? lincahList
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
            Daftar pelanggan, kontak Lincah, dan dropshipper tersimpan di sistem CRM
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950"
            onClick={() => syncLincahMutation.mutate()}
            disabled={syncLincahMutation.isPending}
          >
            <CloudDownload className={`size-4 mr-2 ${syncLincahMutation.isPending ? "animate-spin" : ""}`} />
            {syncLincahMutation.isPending ? "Mengambil..." : "Ambil Data Lincah"}
          </Button>

          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`size-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Menyinkronkan..." : "Sync dari Pesanan"}
          </Button>

          <Button onClick={() => setOpenAddModal(true)}>
            <UserPlus className="size-4 mr-2" /> Tambah Pelanggan
          </Button>
        </div>
      </div>

      {/* METRIC STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="p-3.5 md:p-4 flex items-center gap-3">
          <div className="p-2.5 md:p-3 rounded-lg bg-primary/10 text-primary shrink-0">
            <Users className="size-5 md:size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] md:text-xs text-muted-foreground font-medium">Total Pelanggan</div>
            <div className="text-xl md:text-2xl font-bold tabular-nums mt-0.5">{allCustomers.length}</div>
          </div>
        </Card>

        <Card className="p-3.5 md:p-4 flex items-center gap-3">
          <div className="p-2.5 md:p-3 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
            <Truck className="size-5 md:size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] md:text-xs text-muted-foreground font-medium">Daftar Dropshipper</div>
            <div className="text-xl md:text-2xl font-bold tabular-nums mt-0.5">{dropshipperList.length}</div>
          </div>
        </Card>

        <Card className="p-3.5 md:p-4 flex items-center gap-3">
          <div className="p-2.5 md:p-3 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
            <ShoppingBag className="size-5 md:size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] md:text-xs text-muted-foreground font-medium">Total Transaksi</div>
            <div className="text-base md:text-xl xl:text-2xl font-bold tabular-nums mt-0.5 truncate">{formatIDR(totalSpent)}</div>
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
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              Semua ({allCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="regular" className="text-xs sm:text-sm">
              Pelanggan ({regularList.length})
            </TabsTrigger>
            <TabsTrigger value="dropshipper" className="text-xs sm:text-sm">
              Dropshipper ({dropshipperList.length})
            </TabsTrigger>
            <TabsTrigger value="lincah" className="text-xs sm:text-sm">
              Lincah ({lincahList.length})
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
                <th className="p-3 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="p-3">
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground">
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
                          <Link
                            to="/customers/$id"
                            params={{ id: c.id }}
                            className="hover:underline text-primary font-semibold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.name}
                          </Link>
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
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-primary"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link to="/customers/$id" params={{ id: c.id }}>
                            Detail CRM <ChevronRight className="size-3.5 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* DIALOG MODAL TAMBAH PELANGGAN BARU */}
      <Dialog open={openAddModal} onOpenChange={setOpenAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="size-5 text-primary" />
              Tambah Pelanggan / Dropshipper Baru
            </DialogTitle>
            <DialogDescription>
              Isikan data kontak dan alamat pelanggan baru untuk disimpan ke sistem CRM.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            <div>
              <Label className="text-xs font-semibold">
                Nama Lengkap<span className="text-destructive">*</span>
              </Label>
              <Input
                required
                className="mt-1"
                placeholder="cth. Budi Santoso"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Nomor Telepon / WhatsApp<span className="text-destructive">*</span>
              </Label>
              <Input
                required
                className="mt-1 font-mono"
                placeholder="081234567890"
                value={newForm.phone}
                onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold block mb-1">Kategori / Tipe Kontak</Label>
              <div className="flex flex-wrap gap-2">
                {["Pelanggan", "Dropshipper", "Reseller", "VIP", "Grosir"].map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={newForm.tagType === t ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setNewForm({ ...newForm, tagType: t })}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Alamat Lengkap Pengiriman</Label>
              <Textarea
                rows={2}
                className="mt-1 text-xs"
                placeholder="Jalan, No. Rumah, RT/RW, Patokan..."
                value={newForm.full_address}
                onChange={(e) => setNewForm({ ...newForm, full_address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Kecamatan</Label>
                <Input
                  className="mt-1 text-xs"
                  placeholder="cth. Banjarsari"
                  value={newForm.district}
                  onChange={(e) => setNewForm({ ...newForm, district: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Kota / Kabupaten</Label>
                <Input
                  className="mt-1 text-xs"
                  placeholder="cth. Surakarta"
                  value={newForm.city}
                  onChange={(e) => setNewForm({ ...newForm, city: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Provinsi</Label>
                <Input
                  className="mt-1 text-xs"
                  placeholder="Provinsi"
                  value={newForm.province}
                  onChange={(e) => setNewForm({ ...newForm, province: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Kode Pos</Label>
                <Input
                  className="mt-1 text-xs font-mono"
                  placeholder="57139"
                  value={newForm.postal_code}
                  onChange={(e) => setNewForm({ ...newForm, postal_code: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Catatan CRM Internal</Label>
              <Textarea
                rows={2}
                className="mt-1 text-xs"
                placeholder="Catatan khusus pelanggan..."
                value={newForm.notes}
                onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenAddModal(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !newForm.name || !newForm.phone}>
                {createMutation.isPending ? "Menyimpan..." : "Simpan Pelanggan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
