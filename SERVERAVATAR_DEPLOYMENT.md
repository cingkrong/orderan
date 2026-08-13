# 🚀 Panduan Deployment Maularis OMS di ServerAvatar Panel (Public Git URL)

Dokumen ini berisi panduan langkah demi langkah untuk me-deploy aplikasi **Maularis OMS** menggunakan fitur **Git Public / Custom Repository** di **ServerAvatar Panel**.

---

## 📋 Data Repository Git Public
- **Public Git URL**: `https://github.com/cingkrong/orderan.git`
- **Branch**: `main`

---

## 🛠️ Langkah-Langkah Deployment via Git Public di ServerAvatar

### 1. Buat Node.js Application di ServerAvatar
1. Login ke Dashboard ServerAvatar (`app.serveravatar.com`).
2. Pilih Server VPS Anda $\rightarrow$ Masuk ke menu **Applications** $\rightarrow$ Klik **Create Application**.
3. Isi form pembuatan aplikasi:
   - **Application Name**: `maularis-oms`
   - **Domain**: Masukkan domain Anda (contoh: `oms.domainanda.com`).
   - **Application Type**: Pilih **Node.js**.
   - **Node.js Version**: Pilih **Node.js v20.x LTS** atau **v22.x LTS**.
4. Klik **Create Application**.

---

### 2. Hubungkan via Git Public / Custom Git
1. Di halaman aplikasi ServerAvatar, buka tab **Git Deployment**.
2. Pilih opsi **Custom Git** / **Public Repository**.
3. Masukkan data git:
   - **Git Repository URL**: `https://github.com/cingkrong/orderan.git`
   - **Branch**: `main`
4. Klik **Save / Connect**.

---

### 3. Konfigurasi Deployment Script (Build Commands)
Di bagian **Deployment Commands / Script** pada ServerAvatar, masukkan perintah berikut:

```bash
# 1. Install dependensi
npm install

# 2. Build aplikasi ke format Nitro SSR (.output/)
npm run build
```

---

### 4. Konfigurasi Node.js Startup (Entry Point)
Di bagian **Node.js Configuration / Settings** di ServerAvatar:
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
1. Buka tab **SSL Certificates** di ServerAvatar.
2. Pilih **Let's Encrypt Free SSL**.
3. Klik **Install SSL**.

---

### 7. Jalankan Deploy
1. Klik tombol **Deploy Now** di ServerAvatar.
2. ServerAvatar akan me-clone dari repository public `https://github.com/cingkrong/orderan.git`, meng-install dependensi, membangun paket `.output/server/index.mjs`, dan mengaktifkan SSL pada domain Anda.
