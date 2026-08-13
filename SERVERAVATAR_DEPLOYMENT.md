# 🚀 Panduan Deployment Maularis OMS di ServerAvatar Panel

Dokumen ini berisi panduan langkah demi langkah untuk mengunggah dan mempublikasikan aplikasi **Maularis OMS (`cingkrong/orderan`)** menggunakan **ServerAvatar Panel** pada Server VPS (DigitalOcean, Vultr, Linode, Hetzner, dll).

---

## 📋 Syarat & Prasyarat
1. VPS sudah terhubung dengan **ServerAvatar Panel** (`app.serveravatar.com`).
2. Domain / Subdomain sudah di-pointing A Record IP VPS Anda (contoh: `oms.domainanda.com`).
3. Akses ke repository GitHub: `https://github.com/cingkrong/orderan.git`.

---

## 🛠️ Langkah-Langkah Deployment

### 1. Buat Aplikasi Node.js di ServerAvatar
1. Login ke Dashboard ServerAvatar (`app.serveravatar.com`).
2. Pilih Server VPS Anda.
3. Masuk ke menu **Applications** -> Klik **Create Application**.
4. Isi data aplikasi:
   - **Application Name**: `maularis-oms`
   - **Domain**: `oms.domainanda.com` (atau domain Anda)
   - **Application Type**: Pilih **Node.js**
   - **Node.js Version**: Pilih **Node.js v20.x LTS** atau **v22.x LTS**
5. Klik **Create Application**.

---

### 2. Hubungkan Repository GitHub
1. Di halaman detail aplikasi ServerAvatar, buka tab **Git Deployment**.
2. Hubungkan ke GitHub Account Anda.
3. Masukkan rincian repository:
   - **Repository**: `cingkrong/orderan`
   - **Branch**: `main`
4. Aktifkan **Auto Deploy on Push** *(rekomendasi)* agar setiap `git push origin main` otomatis di-build oleh ServerAvatar.

---

### 3. Konfigurasi Deployment Script (Build Command)
Di tab **Git Deployment** -> **Deployment Commands**, masukkan script berikut:

```bash
# Install paket dependensi
npm install

# Build aplikasi ke folder produksi Nitro SSR (.output/)
npm run build
```

---

### 4. Konfigurasi Node.js Startup (Entry Point)
Di halaman **Node.js Settings / Configuration** pada ServerAvatar:
- **Environment**: `production`
- **Application Port**: `3000` (atau port default ServerAvatar)
- **Entry File / Start Command**:
  ```bash
  .output/server/index.mjs
  ```
  *(Atau jika menggunakan PM2)*:
  ```bash
  npx pm2 start .output/server/index.mjs --name "maularis-oms" || npx pm2 restart "maularis-oms"
  ```

---

### 5. Pengaturan Environment Variables (.env)
Buka tab **Environment Variables** di ServerAvatar dan tambahkan variabel berikut:

```env
PORT=3000
NODE_ENV=production
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
LINCAH_API_KEY=oYeiIJkYFMctQebMQOZfOJYNbHkUzShD
LINCAH_PARTNER_ID=6a4617ceb8fd8dd8aa41906e
LINCAH_ENV=production
```

---

### 6. Aktifkan SSL Certificate (HTTPS Gratis)
1. Buka tab **SSL Certificates** pada aplikasi ServerAvatar.
2. Pilih **Let's Encrypt**.
3. Klik **Install SSL**.

---

### 7. Eksekusi Deploy
1. Klik tombol **Deploy Now** di tab Git Deployment.
2. ServerAvatar akan me-pull commit terbaru dari GitHub, menjalankan `npm run build`, dan mengaktifkan aplikasi Node.js Anda.
3. Akses domain Anda di browser (`https://oms.domainanda.com`).

---

## ⚡ Verifikasi & Maintenance
- **Cek Log Aplikasi**: Buka menu **Logs** -> **Node.js Error / Access Logs** di ServerAvatar.
- **Rollback / Deploy Ulang**: Klik **Deploy** pada commit sebelumnya di tab Git Deployment.
