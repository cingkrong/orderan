# Rencana: Fitur Pencatatan Profit & Laba Rugi

## 1. Skema Database (migrasi)

**`products`** — tambah:
- `cost` numeric(12,2) NOT NULL default 0 — harga modal (HPP) per unit

**`order_items`** — tambah:
- `cost` numeric(12,2) NOT NULL default 0 — snapshot HPP saat order dibuat (agar riwayat P&L tetap akurat bila cost produk berubah)

**`orders`** — tambah:
- `discount` numeric(12,2) NOT NULL default 0 — diskon/voucher per pesanan (mengurangi revenue)
- `marketplace_fee` numeric(12,2) NOT NULL default 0 — fee Shopee/Tokopedia/COD per pesanan
- Update trigger perhitungan `total`: `subtotal - discount + shipping_cost` (biaya kurir tetap pass-through)
- Kolom generated / view untuk `gross_profit = subtotal - discount - sum(cost*qty) - marketplace_fee`

**Tabel baru `expenses`** — pengeluaran operasional & iklan:
- `id`, `date` (date), `category` (enum: `ads`, `operational`, `salary`, `rent`, `packaging`, `other`), `subcategory` (text, mis. "FB Ads", "TikTok Ads"), `source` (text nullable — untuk match ROAS ke `orders.source`), `amount` numeric, `note` text, `created_by`, timestamps
- RLS: staff read, admin insert/update/delete (atau staff manage — sesuai standar existing)
- GRANT SELECT/INSERT/UPDATE/DELETE ke authenticated + ALL ke service_role

**View `order_pnl`** (SECURITY INVOKER) — agregasi per order:
- `order_id`, `created_at`, `source`, `revenue` (subtotal - discount), `cogs` (sum item cost*qty), `marketplace_fee`, `gross_profit`

## 2. Server Functions

**`products.functions.ts`** — schema `productInput` + kolom `cost`.

**`orders.functions.ts`**:
- `itemSchema` + `cost` (default dari produk terpilih, bisa di-override)
- `orderInput` + `discount`, `marketplace_fee`
- `saveOrder`: hitung `total = subtotal - discount + shipping_cost`; simpan `cost` per item

**`expenses.functions.ts` (baru)**:
- `listExpenses({ from, to, category? })`
- `upsertExpense`, `deleteExpense`

**`reports.functions.ts` (baru)**:
- `pnlSummary({ from, to })` — Revenue, Diskon, COGS, Fee marketplace, Gross Profit, Total Biaya (per kategori), Net Profit
- `pnlTrend({ from, to, bucket: 'day'|'month' })` — array {date, revenue, profit}
- `pnlByProduct({ from, to })` — {name, qty_sold, revenue, cogs, gross_profit, margin_pct}
- `pnlBySource({ from, to })` — {source, orders, revenue, gross_profit, ad_spend, roas, net_profit}

## 3. Halaman UI

**Produk** — form input `cost` (Harga Modal) + tampilkan margin di daftar produk.

**Order baru / edit** — di tabel item:
- Kolom Modal (auto dari produk, bisa diubah), Harga Jual, Qty, Subtotal, Profit item
- Ringkasan bawah: Subtotal, **Diskon** (input), **Fee Marketplace** (input), Ongkir, Total; badge "Estimasi profit" (subtotal - diskon - COGS - fee).

**Detail Order** — tampilkan breakdown: Revenue, HPP, Fee, Diskon, Gross Profit.

**Menu baru: `/expenses` — Pengeluaran**
- Filter tanggal + kategori, tabel + total per kategori
- Form inline (route `/expenses/new`, `/expenses/:id/edit`) sesuai preferensi no-popup

**Menu baru: `/reports` — Laba Rugi**
- Filter periode (preset: hari ini / 7d / 30d / bulan ini / custom range)
- **Kartu ringkasan**: Revenue, HPP, Gross Profit, Total Biaya, **Net Profit**, Margin %
- **Chart tren** (Recharts LineChart): revenue vs net profit per hari/bulan
- **Tabel breakdown per Produk**: qty, revenue, COGS, gross profit, margin %
- **Tabel breakdown per Source/Campaign**: orders, revenue, gross profit, biaya iklan (join `expenses.category='ads'` by source), **ROAS**, net profit
- Tombol export CSV per tabel

**Sidebar** — tambah item "Pengeluaran" & "Laporan L/R" (ikon Wallet & TrendingUp).

## 4. Catatan
- Ongkir pass-through: `shipping_cost` tidak masuk perhitungan profit.
- Semua form baru mengikuti pola no-popup (halaman terpisah / inline).
- HPP disimpan snapshot per item agar laporan historis tidak berubah saat cost produk di-update.
- Menggunakan tokens theme existing; tidak menambahkan warna hardcode.
