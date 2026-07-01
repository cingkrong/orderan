import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  listExpenses,
  deleteExpense,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
} from "@/lib/expenses.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/expenses/")({
  component: ExpensesPage,
});

function firstOfMonth() {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd");
}
function today() {
  return format(new Date(), "yyyy-MM-dd");
}

function ExpensesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAll = useServerFn(listExpenses);
  const del = useServerFn(deleteExpense);

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [category, setCategory] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", from, to, category],
    queryFn: () =>
      fetchAll({
        data: {
          from,
          to,
          category: category === "all" ? null : (category as any),
        },
      }),
  });

  const totals = useMemo(() => {
    const rows = data ?? [];
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const byCat: Record<string, number> = {};
    for (const r of rows) byCat[r.category] = (byCat[r.category] ?? 0) + Number(r.amount);
    return { total, byCat };
  }, [data]);

  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Dihapus");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pengeluaran</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Catat biaya iklan, operasional, gaji, dll untuk perhitungan laba rugi.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/expenses/new" })}>
          <Plus className="size-4 mr-1" /> Pengeluaran baru
        </Button>
      </div>

      <Card className="p-4 grid sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Dari</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Sampai</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Kategori</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col justify-end">
          <div className="text-xs text-muted-foreground">Total periode</div>
          <div className="text-2xl font-bold tabular-nums">{formatIDR(totals.total)}</div>
        </div>
      </Card>

      {Object.keys(totals.byCat).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(totals.byCat).map(([c, v]) => (
            <Badge key={c} variant="secondary" className="text-sm py-1">
              {EXPENSE_CATEGORY_LABEL[c]}: <span className="font-mono ml-1">{formatIDR(v)}</span>
            </Badge>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Tanggal</th>
                <th className="p-3 font-medium">Kategori</th>
                <th className="p-3 font-medium">Detail</th>
                <th className="p-3 font-medium">Sumber</th>
                <th className="p-3 font-medium text-right">Jumlah</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : (data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Belum ada pengeluaran pada periode ini</td></tr>
              ) : (
                data!.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3">{format(new Date(e.date), "dd MMM yyyy", { locale: idLocale })}</td>
                    <td className="p-3"><Badge variant="outline">{EXPENSE_CATEGORY_LABEL[e.category]}</Badge></td>
                    <td className="p-3">
                      <div>{e.subcategory ?? "—"}</div>
                      {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                    </td>
                    <td className="p-3 text-muted-foreground">{e.source ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{formatIDR(e.amount)}</td>
                    <td className="p-3 flex gap-1 justify-end">
                      <Button asChild size="icon" variant="ghost">
                        <Link to="/expenses/$id/edit" params={{ id: e.id }}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Hapus pengeluaran ini?")) removeMut.mutate(e.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
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
