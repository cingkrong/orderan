import { useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getExpense,
  upsertExpense,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
} from "@/lib/expenses.functions";
import { SOURCES } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type State = {
  id?: string;
  date: string;
  category: (typeof EXPENSE_CATEGORIES)[number];
  subcategory: string;
  source: string;
  amount: number;
  note: string;
};

export function ExpenseForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getExpense);
  const upsert = useServerFn(upsertExpense);

  const [form, setForm] = useState<State>({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "operational",
    subcategory: "",
    source: "",
    amount: 0,
    note: "",
  });

  const loadQ = useQuery({
    queryKey: ["expense", id],
    queryFn: () => fetchOne({ data: { id: id! } }),
    enabled: !!id,
  });

  useEffect(() => {
    if (loadQ.data) {
      const d = loadQ.data;
      setForm({
        id: d.id,
        date: d.date,
        category: d.category as any,
        subcategory: d.subcategory ?? "",
        source: d.source ?? "",
        amount: Number(d.amount),
        note: d.note ?? "",
      });
    }
  }, [loadQ.data]);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: form.id,
          date: form.date,
          category: form.category,
          subcategory: form.subcategory || null,
          source: form.source || null,
          amount: Number(form.amount) || 0,
          note: form.note || null,
        },
      }),
    onSuccess: () => {
      toast.success("Pengeluaran disimpan");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      navigate({ to: "/expenses" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  if (id && loadQ.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/expenses"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {id ? "Ubah pengeluaran" : "Pengeluaran baru"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Catat biaya operasional / iklan agar masuk ke perhitungan laba rugi.
          </p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Tanggal</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label>Kategori</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Sub-kategori / Nama</Label>
            <Input
              value={form.subcategory}
              onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
              placeholder="cth. FB Ads – Campaign Ramadan"
            />
          </div>
          <div>
            <Label>Sumber (untuk ROAS)</Label>
            <Select value={form.source || "__none"} onValueChange={(v) => setForm({ ...form, source: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Pilih sumber (opsional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Tidak terkait sumber —</SelectItem>
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Isi untuk kategori Iklan agar bisa dihitung ROAS per source.</p>
          </div>
        </div>
        <div>
          <Label>Jumlah (Rp)</Label>
          <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Catatan</Label>
          <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild><Link to="/expenses">Batal</Link></Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || form.amount <= 0}>
          {save.isPending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
