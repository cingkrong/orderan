import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getCustomer, updateCustomerTags } from "@/lib/customers.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIDR, STATUS_LABEL, STATUS_TONE, COURIER_LABEL } from "@/lib/format";
import { ArrowLeft, X, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOne = useServerFn(getCustomer);
  const saveFn = useServerFn(updateCustomerTags);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (data?.customer) {
      setTags(data.customer.tags ?? []);
      setNotes(data.customer.notes ?? "");
    }
  }, [data?.customer]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { id, tags, notes: notes || null } }),
    onSuccess: () => {
      toast.success("Pelanggan disimpan");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) {
      setTagInput("");
      return;
    }
    setTags([...tags, t]);
    setTagInput("");
  }

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }
  if (!data?.customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/customers"><ArrowLeft className="size-4 mr-1" /> Kembali</Link>
        </Button>
        <Card className="p-10 text-center text-muted-foreground">Pelanggan tidak ditemukan</Card>
      </div>
    );
  }

  const c = data.customer;
  const addr = (c.last_address as Record<string, unknown> | null) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/customers"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{c.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">{c.phone}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total pesanan</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{c.total_orders}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total belanja</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{formatIDR(c.total_spent)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Bergabung</div>
          <div className="text-sm font-medium mt-2">
            {c.created_at ? format(new Date(c.created_at), "d MMM yyyy", { locale: idLocale }) : "—"}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Alamat terakhir</h2>
            {addr ? (
              <div className="text-sm mt-2 space-y-1">
                <div>{String(addr.full_address ?? "—")}</div>
                {addr.destination_label ? (
                  <div className="text-xs text-muted-foreground">{String(addr.destination_label)}</div>
                ) : null}
                {addr.postal_code ? (
                  <div className="text-xs text-muted-foreground">Kode pos: {String(addr.postal_code)}</div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Belum ada alamat tersimpan</p>
            )}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Tag & catatan</h2>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tag</label>
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 && <span className="text-xs text-muted-foreground">Belum ada tag</span>}
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="hover:text-destructive"
                    aria-label={`Hapus ${t}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Tambah tag lalu Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Catatan</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Catatan internal tentang pelanggan ini"
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="size-4 mr-1" />
            {save.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Riwayat pesanan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">No. Pesanan</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Kurir / Resi</th>
                <th className="p-3 font-medium text-right">Total</th>
                <th className="p-3 font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground">
                    Belum ada pesanan
                  </td>
                </tr>
              ) : (
                data.orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate({ to: "/orders/$id", params: { id: o.id } })}
                  >
                    <td className="p-3 font-mono text-xs">{o.order_number}</td>
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded-md text-xs font-medium", STATUS_TONE[o.status])}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {o.courier ? (
                        <div>
                          <div>{COURIER_LABEL[o.courier] ?? o.courier}</div>
                          {o.tracking_number && (
                            <div className="text-muted-foreground font-mono">{o.tracking_number}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatIDR(o.total)}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "d MMM yyyy", { locale: idLocale })}
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
