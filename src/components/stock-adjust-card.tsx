import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProduct } from "@/lib/products.functions";
import { adjustStockManual } from "@/lib/stock.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function StockAdjustCard({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const fetchProduct = useServerFn(getProduct);
  const adjust = useServerFn(adjustStockManual);

  const q = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProduct({ data: { id: productId } }),
  });

  const [variantId, setVariantId] = useState<string>("");
  const [delta, setDelta] = useState<string>("");
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const n = parseInt(delta, 10);
      if (!variantId) throw new Error("Pilih varian");
      if (!n || Number.isNaN(n)) throw new Error("Jumlah harus angka bukan 0");
      await adjust({ data: { variant_id: variantId, delta: n, note: note || undefined } });
    },
    onSuccess: () => {
      toast.success("Stok berhasil disesuaikan");
      setDelta("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["product", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements", "product", productId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal menyesuaikan stok"),
  });

  const variants = (q.data as any)?.variants ?? [];

  return (
    <Card className="p-5 space-y-3">
      <div>
        <h2 className="font-semibold">Penyesuaian Stok Manual</h2>
        <p className="text-xs text-muted-foreground">
          Gunakan nilai positif untuk menambah stok (mis. restock), negatif untuk mengurangi
          (mis. rusak / hilang). Semua penyesuaian akan tercatat di Riwayat Stok.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-[2fr_1fr_2fr_auto]">
        <Select value={variantId} onValueChange={setVariantId}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih varian" />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v: any) => {
              const label =
                [v.color, v.size].filter(Boolean).join(" / ") || v.label;
              return (
                <SelectItem key={v.id} value={v.id}>
                  {label} — stok {v.stock}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Input
          type="number"
          placeholder="±jumlah"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
        />
        <Input
          placeholder="Catatan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          Simpan
        </Button>
      </div>
    </Card>
  );
}
