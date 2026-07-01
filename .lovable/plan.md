
## Tujuan

Satu produk (misal "Kaos Polos") bisa punya banyak variasi (S / M / L / XL, atau Merah / Biru), masing-masing dengan **SKU, harga jual, HPP, berat, dan stok sendiri**. Saat membuat pesanan, staff memilih produk → lalu memilih variasi.

## Perubahan Database

Menambah tabel baru `product_variants`:
- `product_id` (FK ke `products`)
- `label` (mis. "Merah / L")
- `sku`, `price`, `cost`, `weight_g`, `stock`
- `is_default` (boolean), `sort_order`
- RLS & GRANT mengikuti pola tabel lain (staff/admin only)

Perubahan pada `order_items`:
- Tambah kolom `variant_id` (FK ke `product_variants`, nullable untuk data lama)
- Kolom `variant` (text) tetap ada sebagai snapshot label

Migrasi data lama:
- Untuk setiap produk existing → buat 1 baris `product_variants` "default" yang menyalin `sku/price/cost/weight_g/stock` dari products. Data pesanan lama tidak diubah (tetap pakai snapshot lama).
- Kolom `sku/price/cost/weight_g/stock` di `products` dipertahankan sebagai *fallback / default template* untuk produk single-variant, tapi UI akan pakai tabel variants sebagai sumber utama.

## Perubahan Server Functions

- `products.functions.ts`
  - `listProducts` → ikut-sertakan array `variants`.
  - `getProduct` → sertakan variants.
  - `upsertProduct` → terima array variants; lakukan diff upsert/delete transaksional. Minimal 1 variasi wajib.
- `orders.functions.ts`
  - `itemSchema` tambah `variant_id` opsional; saat resolve item, ambil harga/HPP/berat default dari variant (bisa dioverride).

## Perubahan UI

### Form Produk (`components/product-form.tsx`)
- Info dasar: Nama, Kategori, Deskripsi.
- Section **"Variasi"** inline (bukan popup):
  - Tabel/list dengan baris: Label, SKU, Harga, HPP, Berat (g), Stok, tombol hapus.
  - Tombol "Tambah variasi".
  - Preview margin per variasi.
- Bila produk hanya butuh 1 varian, tetap satu baris dengan label default "Default".

### List Produk (`products.index.tsx`)
- Kolom baru "Variasi" menampilkan jumlah variasi + rentang harga (mis. "3 variasi · Rp 50rb–75rb").
- Stok total = SUM stok semua variasi.

### Form Pesanan (`orders.new.tsx`)
- Setelah pilih produk, muncul dropdown **Variasi** (inline, bukan popup). Default variant terpilih otomatis kalau cuma satu.
- Harga, HPP, berat auto-fill dari variasi terpilih (tetap bisa dioverride manual seperti sekarang).
- Item order menyimpan `variant_id`, dan `name` = "Nama Produk — Label Variasi".

### Detail Pesanan & Label
- Tampilkan label variasi di daftar item (sudah ada field `variant`, tinggal memastikan diisi).
- Shipping label & queue tidak berubah struktur, hanya teks variasi lebih akurat.

### Laporan
- `reports.functions.ts` → `pnlByProduct` grup berdasarkan `product_id + variant_id` (atau tetap per produk dengan sub-baris variasi — versi awal: per produk, tambah kolom "Variasi teratas" opsional). Untuk iterasi pertama cukup grup per nama item (yang sudah termasuk label variasi).

## Yang TIDAK berubah

- Skema opsi (Size/Color) tidak dibuatkan tabel matrix — variasi tetap **label bebas** biar cepat dan sederhana. Bisa ditingkatkan nanti bila perlu.
- Format cetak label & alur RajaOngkir tidak berubah.

## Urutan Eksekusi

1. Migrasi DB: bikin `product_variants`, tambah `variant_id` di `order_items`, backfill 1 default variant per produk existing.
2. Update server functions produk (list/get/upsert).
3. Update `product-form.tsx` + `products.index.tsx`.
4. Update `orders.new.tsx` (pemilihan variasi + auto-fill).
5. Verifikasi: buat produk 3 variasi → bikin order → cek total, profit, label, laporan.
