## Tujuan

Hapus semua popup pada alur input Produk dan Order supaya klik di luar form tidak menutup & menghilangkan input.

## Perubahan

### 1. Produk — `/products`
Saat ini tombol "New product" dan "Edit" membuka **Dialog** (popup). Akan diganti menjadi halaman tersendiri:

- Buat route baru:
  - `/products/new` — form tambah produk
  - `/products/:id/edit` — form edit produk
- Halaman `/products` jadi murni daftar produk. Tombol "New product" navigasi ke `/products/new`. Tombol "Edit" di tiap baris navigasi ke `/products/:id/edit`.
- Form pakai layout Card biasa (sama style dengan Settings) dengan tombol Save & Cancel. Tidak ada overlay yang bisa di-klik-luar.
- Hapus import & pemakaian `Dialog*` di `products.tsx`.

### 2. Order baru — `/orders/new`
Form order sudah berupa halaman, hanya pemilih kota memakai **Popover** typeahead. Akan diganti agar tidak ada elemen yang menutup karena klik di luar:

- Hapus `Popover/PopoverTrigger/PopoverContent` di blok "City (search RajaOngkir)".
- Ganti dengan komponen inline di dalam form:
  - Input pencarian kota selalu tampil.
  - Daftar hasil tampil tepat di bawah input (maks. tinggi dengan scroll), bukan floating.
  - Setelah dipilih, daftar menyembunyikan diri & tampil ringkasan "City · Province" dengan tombol "Ganti" untuk membuka daftar lagi.
- Tidak mengubah logika query RajaOngkir, kalkulasi ongkir, maupun field lain.

### 3. Pengecekan tambahan
- `orders.index`, `orders.$id`, `orders.$id.edit`, `customers`: sudah inline, tidak ada Dialog/Popover input — tidak diubah.
- Komponen UI `dialog.tsx`/`popover.tsx` tetap ada untuk pemakaian non-form (mis. konfirmasi). Tidak dihapus dari project.

## Catatan teknis

- Route baru memakai pola `createFileRoute` di bawah `_authenticated/`.
- Form edit memuat data lewat server function `getProduct` yang sudah ada di `products.functions.ts` (atau menambah jika belum ada — akan dicek saat implementasi; saat ini sudah ada `listProducts`/`saveProduct`/`deleteProduct`, akan ditambah `getProduct` bila perlu).
- Setelah save, redirect kembali ke `/products` dan invalidate query list.
