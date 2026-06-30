## Yang masih kosong

Setelah saya cek, semua menu utama (Dashboard, Pesanan, Pengiriman, Produk, Pelanggan, Label, Pengaturan) sudah punya halaman. Yang **belum lengkap** adalah halaman detail Pelanggan:

- Server function `getCustomer` dan `updateCustomerTags` sudah ada di `src/lib/customers.functions.ts`, tapi route-nya belum dibuat.
- Di halaman `/customers`, baris pelanggan tidak bisa diklik — jadi data riwayat pesanan & edit tag/catatan tidak bisa diakses.

## Rencana

### 1. Halaman baru: `/customers/$id`
File: `src/routes/_authenticated/customers.$id.tsx`

Isi:
- **Header**: nama, telepon, tombol kembali ke daftar.
- **Ringkasan**: total pesanan, total belanja, tanggal dibuat.
- **Alamat terakhir**: full address, kota/subdistrict dari `last_address` JSONB.
- **Tag & Catatan** (form inline, bukan popup):
  - Input tag (chip add/remove sederhana).
  - Textarea catatan.
  - Tombol "Simpan" → panggil `updateCustomerTags`, invalidate query.
- **Riwayat pesanan**: tabel `order_number`, status (pakai `STATUS_LABEL`), kurir + resi, total, tanggal — setiap baris link ke `/orders/$id`.

### 2. Update daftar pelanggan
File: `src/routes/_authenticated/customers.tsx`
- Bungkus baris dengan `Link to="/customers/$id"` atau `onClick navigate` supaya bisa masuk ke detail.
- Tambah cursor pointer + hover.

### 3. Tidak ada perubahan database
Semua kolom dan server function yang dibutuhkan sudah tersedia.

## Catatan

Kalau ada halaman lain yang menurut Anda masih "kosong" (misalnya analitik di Dashboard, halaman profil user, atau modul lain), beritahu — saya bisa tambahkan ke rencana ini sebelum implementasi.