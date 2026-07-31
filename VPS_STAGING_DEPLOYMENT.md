# 🚀 Panduan Deployment Staging ke VPS (MAULARIS OMS)

Dokumen ini berisi panduan langkah demi langkah untuk menginstal dan menjalankan aplikasi **MAULARIS OMS (Order Management System)** di VPS (Virtual Private Server) menggunakan Node.js, PM2, Nginx, dan HTTPS/SSL.

---

## 📋 Prasyarat System VPS
- **OS**: Ubuntu 22.04 LTS / 24.04 LTS atau Debian 11/12
- **Node.js**: Version 20 LTS
- **Process Manager**: PM2
- **Web Server**: Nginx
- **SSL Certificate**: Certbot (Let's Encrypt)

---

## 🔑 1. Environment Variables (.env)
Buat file `.env` di direktori root aplikasi di VPS dengan isi berikut:

```env
SUPABASE_PROJECT_ID="ssntqbtneotitoojvmsq"
SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzbnRxYnRuZW90aXRvb2p2bXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NTQ0NzcsImV4cCI6MjEwMTAzMDQ3N30.F60s0JAR0CWw404kUEabeOw7gBTfJtVXQtA29MoJCi8"
SUPABASE_URL="https://ssntqbtneotitoojvmsq.supabase.co"
VITE_SUPABASE_PROJECT_ID="ssntqbtneotitoojvmsq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzbnRxYnRuZW90aXRvb2p2bXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NTQ0NzcsImV4cCI6MjEwMTAzMDQ3N30.F60s0JAR0CWw404kUEabeOw7gBTfJtVXQtA29MoJCi8"
VITE_SUPABASE_URL="https://ssntqbtneotitoojvmsq.supabase.co"
LINCAH_API_KEY="oYeiIJkYFMctQebMQOZfOJYNbHkUzShD"
LINCAH_PARTNER_ID="6a4617ceb8fd8dd8aa41906e"
LINCAH_ENV="development"
```

---

## 🛠️ 2. Langkah-Langkah Deployment di VPS

### **Langkah 2.1: Update Server & Install Node.js, PM2, Nginx**
Jalankan perintah ini di SSH terminal VPS:

```bash
# 1. Update paket sistem
sudo apt update && sudo apt upgrade -y

# 2. Install Git, Nginx, dan Certbot
sudo apt install -y git nginx curl certbot python3-certbot-nginx

# 3. Install Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install PM2 (Process Manager Global)
sudo npm install -g pm2
```

---

### **Langkah 2.2: Clone Project & Set Up File `.env`**

```bash
# 1. Clone repository dari GitHub
git clone https://github.com/cingkrong/orderan.git
cd orderan

# 2. Buat file .env
nano .env
```
*(Salin & paste isi variabel dari **Bagian 1** di atas, lalu simpan dengan `Ctrl + O`, `Enter`, `Ctrl + X`)*.

---

### **Langkah 2.3: Install Dependencies & Build Application**

```bash
# 1. Install semua dependensi
npm install

# 2. Build aplikasi untuk produksi
npm run build
```

---

### **Langkah 2.4: Jalankan Aplikasi Menggunakan PM2**

```bash
# 1. Start server aplikasi via PM2
pm2 start .output/server/index.mjs --name "maularis-staging"

# 2. Simpan daftar proses PM2 agar otomatis jalan saat VPS reboot
pm2 save
pm2 startup
```

---

### **Langkah 2.5: Konfigurasi Reverse Proxy Nginx & SSL (HTTPS)**

1. Buat file konfigurasi Nginx untuk domain/subdomain staging Anda:

```bash
sudo nano /etc/nginx/sites-available/staging-maularis
```

2. Tempelkan konfigurasi Nginx berikut *(sesuaikan `staging.domainanda.com` dengan domain Anda)*:

```nginx
server {
    listen 80;
    server_name staging.domainanda.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Aktifkan konfigurasi Nginx & pasang SSL HTTPS:

```bash
# Symlink ke sites-enabled
sudo ln -s /etc/nginx/sites-available/staging-maularis /etc/nginx/sites-enabled/

# Test sintaks Nginx
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Pasang Sertifikat SSL Gratis (HTTPS) dari Let's Encrypt
sudo certbot --nginx -d staging.domainanda.com
```

---

## 🔄 3. Cara Update Aplikasi di Masa Mendatang (Maintenance)
Jika ada pembaruan kode di GitHub, jalankan perintah ini di folder project di VPS:

```bash
cd orderan
git pull origin main
npm install
npm run build
pm2 reload maularis-staging
```

---

## 🗄️ 4. Skema Database Supabase
File gabungan migrasi database tersimpan di repository:
👉 `supabase/all_migrations.sql`

Jika Anda ingin mengulang atau memasang skema database di project Supabase lain di kemudian hari, cukup jalankan seluruh isi file `supabase/all_migrations.sql` di **Supabase SQL Editor**.
