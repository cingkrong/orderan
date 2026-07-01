## 1. Custom jasa kirim di halaman pemesanan (prioritas)

Di `src/routes/_authenticated/orders.new.tsx`, di dalam card Pengiriman (di bawah daftar `services`), tambahkan panel kecil "Jasa kirim custom":

- Dua input inline: **Nama Ekspedisi** (text, contoh: "Gojek", "Grab", "Kurir Toko") dan **Ongkir (Rp)** (number).
- Tombol **"Gunakan"** → langsung set `form.courier = "custom"`, `form.service = <nama>`, `form.shipping_cost = <nilai>`, `form.eta = "-"`, dan menyorot pilihan aktif seperti item di list.
- Tombol kecil **"Simpan sebagai preset"** (opsional, checkbox "simpan ke pengaturan") → panggil `updateSettings` untuk append ke `settings.custom_couriers` supaya muncul otomatis di order berikutnya lewat `getShippingCost`.
- Tidak perlu popup / modal — semua inline, mengikuti aturan proyek.

Tidak ada perubahan skema DB (kolom `orders.courier`, `service`, `shipping_cost` sudah menampung ini; `settings.custom_couriers` sudah ada).

## 2. Laporan Omzet & Profit dengan filter status

Masalah saat ini: `src/lib/reports.functions.ts` memfilter `.neq("status", "cancelled")` sehingga pesanan `pending` sudah dihitung sebagai omzet & profit, padahal user ingin **pending = belum masuk perhitungan**.

Perubahan:

**a. Server (`src/lib/reports.functions.ts`)**
- Tambah input opsional `statuses: string[]` (default: `["processing","shipped","delivered"]` — mengecualikan `pending` dan `cancelled`).
- Tambah input opsional `paymentStatuses: string[]` (default: semua) untuk memisahkan omzet "Lunas" vs "Belum Lunas".
- Terapkan filter di `loadPeriod` (`.in("status", …)` bila diberikan).
- Tambah handler baru `revenueBreakdown` yang mengembalikan agregat per status: `{ status, orders, revenue, grossProfit, netProfit }` supaya user bisa lihat "omzet tertunda" terpisah.

**b. UI (`src/routes/_authenticated/reports.tsx`)**
- Tambah row filter di atas: date range (sudah ada) + **multi-select status pesanan** (Tertunda / Diproses / Dikirim / Selesai / Batal) + **filter status pembayaran** (Semua / Lunas / Belum Lunas).
- Tambah card baru **"Ringkasan per Status"** (tabel) memakai `revenueBreakdown` — menampilkan omzet & profit tertunda vs terkonfirmasi secara berdampingan.
- Semua chart & summary yang sudah ada ikut memakai filter tersebut.

## Technical notes

- Custom courier UI: tetap dalam `FormSection` "Pengiriman", sekitar baris 714 di `orders.new.tsx`.
- Preset save memakai `updateSettings` yang existing — merge dengan array `custom_couriers` yang sudah ada agar tidak menimpa.
- Report filter default sengaja mengecualikan `pending` supaya angka default = profit yang sudah pasti; user bisa expand dengan mencentang "Tertunda" kalau perlu.
