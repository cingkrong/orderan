## Masalah 1 — Tombol "Produk baru" & "Ubah" tidak membuka form
Penyebab: `src/routes/_authenticated/products.tsx` adalah route daftar sekaligus induk dari `products.new` & `products.$id.edit`, tapi tidak merender `<Outlet />`. Akibatnya rute anak match tapi form tak pernah tampil.

**Fix:**
- Rename `src/routes/_authenticated/products.tsx` → `products.index.tsx` (isi daftar tetap). Ini menghapus konflik layout — route anak jadi sibling murni, form tampil normal.

## Masalah 2 — Penanda label sudah dicetak (bisa cetak ulang)

### Database (migrasi)
Tambah kolom di `orders`:
- `label_printed_at` (timestamptz, nullable) — waktu terakhir cetak
- `label_print_count` (int, default 0) — jumlah cetak

### Backend
`src/lib/orders.functions.ts` — server fn baru `markLabelPrinted({ ids: string[] })` yang meng-`update` `label_print_count = label_print_count + 1` dan `label_printed_at = now()` untuk semua id.

### Halaman Label (`src/routes/_authenticated/labels.tsx`)
- Bungkus `window.print()` supaya sebelum panggil print, jalankan `markLabelPrinted` untuk semua `ids` yang di-render, lalu invalidate query `orders` & `order`.
- Tampilkan ringkasan kecil (no-print): "X dari Y label sudah pernah dicetak" dengan badge di tiap kartu preview kalau `label_print_count > 0`.

### Detail Pesanan (`src/routes/_authenticated/orders.$id.tsx`)
- Tombol "Cetak label" panggil `markLabelPrinted({ ids: [id] })` sebelum `window.print()`.
- Tampilkan badge "Dicetak N×" + waktu terakhir (format `date-fns` locale id) di header kalau `label_print_count > 0`. Tombol tetap boleh dipakai untuk cetak ulang (label berubah jadi "Cetak ulang label").

### Daftar Pesanan (`src/routes/_authenticated/orders.index.tsx`)
- Kolom / badge kecil "Label ✓ N×" pada baris yang sudah pernah dicetak.
- Tombol bulk "Cetak label" tetap seperti sekarang (navigasi ke `/labels?ids=...`); penandaan otomatis terjadi di halaman label.

### Halaman Pengiriman (`src/routes/_authenticated/shipping.tsx`)
- Badge status cetak yang sama di setiap baris antrian.
- Tombol per baris "Cetak label" / "Cetak ulang" (teks berubah sesuai `label_print_count`), navigasi ke `/labels?ids=<id>`.

## Catatan
- Sesuai jawaban: penandaan **otomatis saat tombol Cetak ditekan** (bukan manual). User bisa cetak ulang kapan saja — counter naik terus, tidak ada block.
- Perubahan hanya menambah kolom & satu server fn; struktur label & order lain tidak berubah.
