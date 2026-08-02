# Changelog - OMS Orderan & Logistics System

## [v2.4.0] - 2026-08-02

### 🌟 Fitur Baru & Peningkatan Utama

#### 1. 🔌 Integrasi Addons & Platform (`/integrations`)
- Halaman terpusat untuk setup dan manajemen integrasi platform eksternal.
- **Lincah.id**: Pengaturan API Key, Partner ID, dan Environment (Sandbox/Production).
- **WhatsApp Gateway**: Integrasi Fonnte, Wablas, atau Custom REST API untuk notifikasi resi dan follow-up otomatis.
- **Marketplace Sync**: Shopee Seller API, TikTok Shop, dan Tokopedia Seller API.
- **Webhook & Automations**: Webhook JSON real-time untuk n8n, Make, dan server custom.

#### 2. 💰 Custom Diskon Ongkir & Seller Margin Profit (`/settings`)
- Penjual dapat mengatur persentase diskon ongkir (COD & Non-COD) untuk setiap kurir.
- Selisih antara diskon resmi Lincah.id dan diskon pembeli menjadi **Margin Profit Seller**.
- **Validasi Kritis**: Otomatis mengunci persentase diskon agar **TIDAK MELEBIHI** batas maksimal resmi Lincah.id (Ninja COD maks 50%, SAP COD maks 45%, SiCepat COD maks 35%, JNE COD maks 30%, dll).

#### 3. 🚚 Official Courier Image Logos (`https://assets.lincah.id/images/logo/`)
- Integrasi logo gambar fisik resmi langsung dari CDN Lincah.id.
- Ditampilkan pada **Resi Cetak Thermal/A4**, **Daftar Pesanan**, **Detail Pesanan**, **Form Input Order**, dan **Pengaturan OMS**.
- Dilengkapi instant fallback data URI agar logo tidak pernah broken saat offline.

#### 4. 📊 Market Analyzer Dashboard (`/analyzer`)
- Dashboard analisa performa bisnis: **Best Seller Products**, **Best Customers / Resellers / Dropshippers**, dan **Customer Location Ranking (1-10 Kota)**.

#### 5. 🔍 Live Kecamatan Selector (CRM Pelanggan)
- Pencarian subdistrict/kecamatan real-time via Lincah API pada Detail Pelanggan (`/customers/$id`) dan Modal Tambah Pelanggan.
- Populates otomatis Kecamatan, Kota, Provinsi, Kode Pos, dan District ID Lincah.

#### 6. ⚙️ Pengaturan Produk Tingkat Lanjut (`/products`)
- Sidebar **Product Setting** dengan Toggle Varian, Diskon, dan Harga Grosir.
- Multi-photo & video uploader dengan fallback thumbnail default.
- Perhitungan berat presisi dalam **gram** (mencegah bentrok ongkir).
- Validasi stok ketat (client & server) untuk mencegah pesanan melebihi stok fisik.

---

## 📝 Commit Tag & Version
- **Tag Label**: `v2.4.0`
- **Release Name**: `v2.4.0 - Major Addons Integration & Logistics Margin System`
