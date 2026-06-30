## Konteks

API lama (`api.rajaongkir.com/starter` dengan endpoint `/city` & `/cost`) sudah dimatikan. API V2 sekarang di-host Komerce:

- Base URL: `https://rajaongkir.komerce.id/api/v1/`
- Header auth tetap: `key: <API_KEY>`
- Endpoint baru yang kita pakai:
  - `GET destination/domestic-destination?search=<q>&limit=&offset=` — cari tujuan langsung, balik berisi **subdistrict_id** (kelurahan) + nama lengkap (kelurahan, kecamatan, kota, provinsi, kode pos).
  - `POST calculate/domestic-cost` (form-url-encoded: `origin`, `destination`, `weight`, `courier`) — `origin` & `destination` keduanya **subdistrict_id**, `courier` bisa multi (mis. `jne:sicepat:jnt`), `weight` dalam gram.

Konsekuensi: cache `rajaongkir_cities` dan field `origin_city_id` / `destination_city_id` tidak relevan lagi. Kita ganti dengan pencarian live + simpan `subdistrict_id`.

## Yang akan diubah

### 1. Server functions (`src/lib/shipping.functions.ts`)
- Ganti base URL ke `https://rajaongkir.komerce.id/api/v1`.
- Hapus `syncCities` (tidak ada lagi endpoint daftar kota massal pada V2 jalur direct-search).
- Ganti `searchCities` → `searchDestinations({ q })` yang memanggil `destination/domestic-destination` (debounced di UI). Field yang dikembalikan: `id`, `label` (gabungan kelurahan/kecamatan/kota/provinsi), `subdistrict_name`, `district_name`, `city_name`, `province_name`, `zip_code`.
- Ganti `getShippingCost` → POST `calculate/domestic-cost` dengan `origin = settings.origin_subdistrict_id`, `destination = data.destination_subdistrict_id`, `courier` (default `jne:sicepat:jnt:pos:tiki` atau parameter), `weight`.
- Normalisasi response V2 (`data.data` adalah array layanan) ke bentuk yang sudah dipakai UI: `{ courier, courier_name, services: [{ service, description, value, etd }] }`.
- Pertahankan try/catch + timeout supaya kegagalan jaringan tidak crash UI.

### 2. Database (migrasi baru)
- `settings`: tambah kolom `origin_subdistrict_id text`, `origin_label text`. Field lama (`origin_city_id`, `origin_type`) dibiarkan untuk backward-compat, tapi tidak dipakai lagi.
- `orders`: tambah `destination_subdistrict_id text`, `destination_label text`. Kolom lama `destination_city_id` dibiarkan (nullable).
- `customers.last_address`: simpan juga `subdistrict_id` + `label` di JSON.
- Hapus tabel `rajaongkir_cities` (atau biarkan kosong tanpa dipakai — saya akan drop untuk kebersihan).

### 3. Halaman Settings (`src/routes/_authenticated/settings.tsx`)
- Hapus tombol "Sync RajaOngkir city list" dan input "origin city ID / type".
- Ganti dengan **pencarian inline** asal gudang (debounced) memakai `searchDestinations`. Setelah dipilih, simpan `origin_subdistrict_id` + `origin_label` ke `settings`. Tombol "Ganti" untuk reset (sesuai memory: jangan pakai popup).

### 4. Halaman Order Baru (`src/routes/_authenticated/orders.new.tsx`)
- Pencarian kota inline yang sudah ada diarahkan ke `searchDestinations` baru; yang disimpan ke order = `destination_subdistrict_id` + `destination_label` (label ditampilkan, "Ganti" untuk reset).
- Saat hit ongkir, kirim `destination_subdistrict_id` ke `getShippingCost`. Penanganan error tetap menampilkan toast, bukan blank screen.

### 5. Order details / customer autofill
- Saat customer dipilih, autofill `destination_subdistrict_id` + `destination_label` dari `customers.last_address` (kalau ada).
- Tidak perlu perubahan label pengiriman (label cetak hanya butuh alamat teks + kota; tetap berfungsi).

## Catatan teknis

- Secret `RAJAONGKIR_API_KEY` tetap dipakai apa adanya — pastikan key yang dipakai adalah key V2 dari dashboard RajaOngkir/Komerce (key starter lama tidak akan jalan di endpoint baru).
- Courier code di V2: `jne`, `sicepat`, `jnt`, `pos`, `tiki`, `anteraja`, `ninja`, `ide`, `sap`, `wahana`, dll. Default UI: tampilkan semua hasil dari multi-courier call sekaligus (lebih sedikit roundtrip).
- Tidak ada perubahan terhadap auth/RLS/role.

## Hasil akhir yang user lihat

1. Di **Settings**, isi alamat pengirim → cari & pilih kelurahan asal gudang → simpan. Tidak ada lagi tombol sync kota.
2. Di **Order baru**, cari kelurahan tujuan langsung (mis. ketik "Cilandak") → pilih → klik "Hitung ongkir" → muncul daftar layanan dari semua kurir → pilih layanan.
3. Pesan error jelas kalau API key salah / kuota habis / jaringan gagal, tanpa blank screen.
