import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetSalesData } from "@/lib/orders.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, RotateCcw, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABEL } from "@/lib/format";

interface ResetSalesDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ResetSalesDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ResetSalesDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  const [mode, setMode] = useState<"all" | "by_date" | "by_status">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("cancelled");
  const [resetCustomerStats, setResetCustomerStats] = useState(true);
  const [deleteExpenses, setDeleteExpenses] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");

  const resetFn = useServerFn(resetSalesData);
  const qc = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: () =>
      resetFn({
        data: {
          mode,
          fromDate: mode === "by_date" ? fromDate : undefined,
          toDate: mode === "by_date" ? toDate : undefined,
          status: mode === "by_status" ? status : undefined,
          resetCustomerStats,
          deleteExpenses,
          confirmationKeyword: mode === "all" ? confirmationInput : undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.count > 0
          ? `Berhasil mereset data penjualan (${res.count} pesanan dihapus).`
          : res.message || "Data penjualan berhasil direset."
      );
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setIsOpen(false);
      // Reset form state
      setConfirmationInput("");
      setFromDate("");
      setToDate("");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Gagal mereset data penjualan");
    },
  });

  const isConfirmationValid =
    mode !== "all" || confirmationInput.trim().toUpperCase() === "RESET";

  const handleOpenChange = (openState: boolean) => {
    setIsOpen(openState);
    if (!openState) {
      setConfirmationInput("");
      setMode("all");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <div className="p-2 rounded-lg bg-destructive/10">
              <ShieldAlert className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold">Reset Data Penjualan</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Fitur ini digunakan untuk membersihkan transaksi penjualan/pesanan (misalnya setelah masa testing atau pembersihan berkala). Tindakan ini bersifat permanen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Cakupan Reset</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode("all")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  mode === "all"
                    ? "border-destructive bg-destructive/5 text-destructive font-medium shadow-sm"
                    : "border-border hover:bg-accent text-xs text-muted-foreground"
                }`}
              >
                <div className="text-xs font-bold">Semua Pesanan</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Hapus total transaksi</div>
              </button>

              <button
                type="button"
                onClick={() => setMode("by_date")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  mode === "by_date"
                    ? "border-destructive bg-destructive/5 text-destructive font-medium shadow-sm"
                    : "border-border hover:bg-accent text-xs text-muted-foreground"
                }`}
              >
                <div className="text-xs font-bold">Rentang Tanggal</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Filter tanggal tertentu</div>
              </button>

              <button
                type="button"
                onClick={() => setMode("by_status")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  mode === "by_status"
                    ? "border-destructive bg-destructive/5 text-destructive font-medium shadow-sm"
                    : "border-border hover:bg-accent text-xs text-muted-foreground"
                }`}
              >
                <div className="text-xs font-bold">Status Tertentu</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Contoh: Cancelled</div>
              </button>
            </div>
          </div>

          {/* By Date Options */}
          {mode === "by_date" && (
            <div className="p-3 bg-muted/40 rounded-lg border space-y-2.5 animate-in fade-in-50">
              <div className="text-xs font-semibold">Pilih Rentang Tanggal Pembuatan Pesanan</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Dari Tanggal</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Sampai Tanggal</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* By Status Options */}
          {mode === "by_status" && (
            <div className="p-3 bg-muted/40 rounded-lg border space-y-2.5 animate-in fade-in-50">
              <Label className="text-xs font-semibold">Pilih Status Pesanan yang Akan Dihapus</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cancelled">Dibatalkan ({STATUS_LABEL.cancelled})</SelectItem>
                  <SelectItem value="pending">Pending ({STATUS_LABEL.pending})</SelectItem>
                  <SelectItem value="confirmed">Confirmed ({STATUS_LABEL.confirmed})</SelectItem>
                  <SelectItem value="processing">Diproses ({STATUS_LABEL.processing})</SelectItem>
                  <SelectItem value="shipped">Dikirim ({STATUS_LABEL.shipped})</SelectItem>
                  <SelectItem value="completed">Selesai ({STATUS_LABEL.completed})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Extra options */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="reset-customer-stats"
                checked={resetCustomerStats}
                onCheckedChange={(v) => setResetCustomerStats(!!v)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5 leading-none">
                <label
                  htmlFor="reset-customer-stats"
                  className="text-xs font-medium cursor-pointer"
                >
                  Hitung ulang / Reset akumulasi transaksi pelanggan
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Menyesuaikan total order dan pengeluaran (total spent) pelanggan berdasarkan data tersisa.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="delete-expenses"
                checked={deleteExpenses}
                onCheckedChange={(v) => setDeleteExpenses(!!v)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5 leading-none">
                <label
                  htmlFor="delete-expenses"
                  className="text-xs font-medium cursor-pointer"
                >
                  Hapus juga data pengeluaran (Expenses) terkait
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Data biaya operasional / pengeluaran dalam rentang periode ini juga akan dihapus.
                </p>
              </div>
            </div>
          </div>

          {/* Safety Confirmation for Full Reset */}
          {mode === "all" && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
              <div className="flex items-center gap-1.5 text-destructive font-semibold text-xs">
                <AlertTriangle className="size-3.5" />
                <span>Konfirmasi Keamanan Penghapusan Total</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Ketik <strong className="text-destructive font-mono">RESET</strong> di kolom bawah untuk mengonfirmasi bahwa Anda yakin ingin menghapus semua data pesanan.
              </p>
              <Input
                placeholder="Ketik RESET"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                className="h-8 text-xs font-mono uppercase border-destructive/40 focus-visible:ring-destructive"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
            disabled={resetMutation.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!isConfirmationValid || resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
          >
            {resetMutation.isPending ? (
              <>
                <RotateCcw className="size-3.5 mr-1.5 animate-spin" />
                Mereset Data...
              </>
            ) : (
              <>
                <Trash2 className="size-3.5 mr-1.5" />
                Eksekusi Reset Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
