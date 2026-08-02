# Panduan Troubleshooting Production - OMS Orderan

Dokumen ini berisi panduan penanganan masalah (*troubleshooting guide*) untuk lingkungan **Production** jika terjadi error pada sistem OMS, kalkulasi ongkir, integrasi Lincah.id, Supabase, atau web server.

---

## 🚀 1. Pengecekan Awal Saat Terjadi Error di Production

Jika sistem mengalami kendala (misal: halaman blank, gagal booking resi, atau gagal simpan pesanan):

### Step 1: Periksa Browser Console & Network Tab
1. Buka halaman di browser -> Tekan `F12` -> Buka tab **Console** dan **Network**.
2. Periksa baris teks berwarna merah:
   - Error **`401 Unauthorized`**: API Key Lincah.id atau Session Supabase Auth telah kadaluwarsa / salah.
   - Error **`422 Unprocessable Entity`**: Data request payload (cth. ID Kecamatan atau Berat) tidak valid.
   - Error **`500 Internal Server Error`**: Terjadi kendala server-side function / koneksi database Supabase.

### Step 2: Periksa Application Logs Server
- **Server Dev/Production**:
  ```bash
  npm run build
  npm run start
  ```
- **Vercel / Netlify Logs**:
  Buka Dashboard Deployment -> Buka tab **Logs** / **Functions Log** -> Cari timestamp saat error terjadi.

---

## 🛠️ 2. Penanganan Masalah Spesifik (Common Production Errors)

### 🔴 Case A: Ongkos Kirim Tidak Muncul / Error `Failed to fetch Lincah API`
* **Penyebab**: API Key / Partner ID Lincah.id di Pengaturan OMS kadaluwarsa, atau Environment masih berada di mode `development` (Sandbox).
* **Solusi & Troubleshooting**:
  1. Masuk ke menu **Pengaturan OMS (`/settings`)** atau **Integrasi Addons (`/integrations`)**.
  2. Pastikan **Environment Mode** diset ke **`Production (Live)`**.
  3. Pastikan **API Key** dan **Partner ID** sesuai dengan kredensial akun Production Lincah.id.
  4. Klik tombol **"Uji Koneksi Lincah.id"**. Jika status menunjukkan `✓ Terhubung (Saldo Rp ...)` maka koneksi API aktif.
  5. Pastikan ID Kecamatan Asal (`origin_subdistrict_id`) terisi di Pengaturan OMS.

---

### 🔴 Case B: Resi Cetak Label / Gambar Logo Kurir Tidak Muncul (Blank Logo)
* **Penyebab**: Koneksi internet terbatas atau CDN blocked.
* **Solusi & Troubleshooting**:
  1. Sistem telah dilengkapi **Auto-Fallback Data URI (Embedded Vector SVG)** di `src/components/courier-logo.tsx`.
  2. Jika URL `https://assets.lincah.id/images/logo/{code}.png` tidak dapat diakses oleh jaringan lokal printer, sistem akan otomatis beralih ke SVG Data URI internal tanpa perlu koneksi internet.
  3. Untuk memastikan logo tercetak sempurna pada printer thermal, buka **Pengaturan Cetak Browser** -> Centang opsi **"Background Graphics"** / **"Grafik Latar Belakang"**.

---

### 🔴 Case C: Error Validasi Diskon Ongkir / Margin Seller
* **Penyebab**: Pengguna memasukkan nilai diskon ongkir melebihi batas maksimal resmi Lincah.id.
* **Solusi & Troubleshooting**:
  1. Sistem secara otomatis membatasi (*cap*) diskon ke batas maksimum resmi (`Math.min(userDiscount, officialMax)`).
  2. Buka **Pengaturan OMS (`/settings`)** -> Buka tabel **Pengaturan Diskon Ongkir & Margin Seller**.
  3. Pastikan tidak ada indikator warna merah `❌ Melebihi batas Lincah`.
  4. Simpan kembali pengaturan dengan mengeklik **"Simpan Pengaturan"**.

---

### 🔴 Case D: Database Supabase Error / Table `settings` Missing Column
* **Penyebab**: Schema migration Supabase belum berjalan penuh.
* **Solusi & Troubleshooting**:
  1. Pengaturan ekstra (seperti `courier_discounts`, `__addons`, `lincah_couriers`) disimpan secara fleksibel di dalam kolom JSONB `custom_couriers`.
  2. Jika terjadi error database, jalankan query perbaikan di **Supabase SQL Editor**:
     ```sql
     UPDATE settings
     SET custom_couriers = '{}'::jsonb
     WHERE id = 1 AND custom_couriers IS NULL;
     ```

---

## ⏪ 3. Langkah Rollback Darurat (Emergency Rollback)

Jika build production gagal atau membutuhkan pengembalian versi sebelumnya:

1. **Rollback Commit Git**:
   ```bash
   git log --oneline -n 5
   git checkout v2.4.0
   ```
2. **Re-build Production Application**:
   ```bash
   npm run build
   ```
3. **Restart Server**:
   ```bash
   pm2 restart oms-app  # atau npm run start
   ```

---

## 📞 4. Kontak Bantuan & Support Integrasi
- **Dokumentasi Lincah API**: [https://lincah.id/docs](https://lincah.id/docs)
- **Status Server Lincah**: [https://status.lincah.id](https://status.lincah.id)
