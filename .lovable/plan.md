## Tujuan
Menambahkan dukungan **pesanan dropship** — label "Dropship" di daftar pelanggan + field pengirim dropship (nama & telepon) di form pesanan, yang ikut tercetak di label pengiriman.

## Perubahan Database
Migrasi baru menambahkan kolom di tabel `orders`:
- `is_dropship` (boolean, default false)
- `dropship_name` (text, nullable)
- `dropship_phone` (text, nullable)

Trigger `update_customer_rollup()` diperbarui: jika `is_dropship = true`, tandai pelanggan tersebut dengan menambahkan tag `"dropship"` di kolom `customers.tags` (append kalau belum ada). Pelanggan yang pernah dropship otomatis punya label ini di daftar Pelanggan.

## Backend
`src/lib/orders.functions.ts` — tambah 3 field di skema `orderInput` (`is_dropship`, `dropship_name`, `dropship_phone`) supaya bisa disimpan lewat `saveOrder`.

## Form Pesanan (`src/routes/_authenticated/orders.new.tsx`)
Tambah section baru "Dropship" di kartu Customer, di atas atau bawah alamat:
- Switch **"Kirim sebagai dropship"** (`is_dropship`)
- Saat aktif, tampilkan 2 input inline (tidak popup): **Nama pengirim** dan **Telepon pengirim**
- Muat nilai ini juga saat mode edit dari `existingQ.data`

## Label Pengiriman (`src/components/shipping-label.tsx`)
Bagian "Pengirim" pada label: kalau `order.is_dropship`, ganti nama & telepon pengirim dengan `dropship_name` / `dropship_phone` (alamat gudang tetap dari settings sebagai origin — hanya identitas pengirim di label yang berubah, sesuai praktik dropship umum).

## Halaman Pelanggan
- `src/routes/_authenticated/customers.tsx`: tampilkan badge "Dropship" pada baris pelanggan yang tags-nya mengandung `"dropship"`.
- `src/routes/_authenticated/customers.$id.tsx`: badge yang sama muncul otomatis (sudah render tags).

## Detail Pesanan (`src/routes/_authenticated/orders.$id.tsx`)
Tampilkan info dropship (nama + telepon pengirim) bila `is_dropship = true`, dengan badge kecil "Dropship".

## Catatan Teknis
- Tidak ada popup baru; semua input dropship inline mengikuti aturan proyek.
- Tag `"dropship"` tetap bisa diedit manual di halaman detail pelanggan (tag editor sudah ada).
