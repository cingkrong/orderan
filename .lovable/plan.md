## OMS v1 — Orders, Shipping (RajaOngkir), Labels

Build an internal admin OMS on TanStack Start + Lovable Cloud. v1 = Auth, Dashboard, Orders, Products, Customers, RajaOngkir shipping cost, and a 100×150 mm thermal label generator with barcode/QR + bulk print. Finance, Discount, Inventory, Reports/Analytics are deferred.

### Stack
- TanStack Start (React) + TanStack Query + shadcn/ui + Tailwind
- Lovable Cloud (Postgres + auth + server functions)
- RajaOngkir via `createServerFn` (key stored as secret)
- `jsbarcode` + `qrcode` for labels; `@react-pdf/renderer`-free CSS print (A6/100×150 mm `@page`)

### Auth & roles
- Email + password (admin sign-in only; signup disabled in UI)
- `user_roles` table + `has_role()` security-definer fn (admin, staff)
- Protected app lives under `_authenticated/`; `/auth` is public

### Database (migrations)
- `profiles` (id → auth.users, full_name)
- `app_role` enum (admin, staff) + `user_roles` + `has_role()`
- `products` (name, sku, price, weight_g, stock, variant)
- `customers` (name, phone unique, tags text[], notes, last_address jsonb)
- `orders` (order_number unique, customer_id, snapshot fields: customer_name, phone, full_address, province, city, district, postal_code, courier, service, tracking_number, status enum, source, campaign, ref, shipping_cost, eta, weight_g, subtotal, insurance bool, routing_code, note, created_by, created_at)
- `order_items` (order_id, product_id, name, variant, qty, price, weight_g)
- `settings` (singleton: sender_name, sender_phone, sender_city, origin_city_id, origin_type, logo_url)
- All public tables get GRANTs + RLS (authenticated read/write; admin-only deletes via `has_role`)
- Trigger: auto-generate `order_number` = `INV-YYYYMMDD-XXXX`

### Server functions (`src/lib/*.functions.ts`)
- `orders`: list (filter/search/paginate), get, create, update, updateStatus, bulkUpdateStatus, setTracking
- `products`, `customers`: CRUD
- `settings`: get, update
- `shipping.getCost({ destination_city_id, weight_g, courier })` → RajaOngkir starter `/cost` endpoint, returns services [{service, cost, etd}]
- `shipping.searchCity(q)` → cached city list (seed once into `rajaongkir_cities` table for fast typeahead)
- All use `requireSupabaseAuth`; RajaOngkir key read from `process.env.RAJAONGKIR_API_KEY` inside handler

### Routes
```
/auth                              public sign-in
/_authenticated/route.tsx          managed gate
  /                                Dashboard
  /orders                          list + filters + bulk actions
  /orders/new                      create (fast form)
  /orders/$id                      detail + edit + status
  /shipping                        tracking input + filter by courier
  /products                        CRUD
  /customers                       list + history
  /labels                          bulk label print (select orders)
  /settings                        sender/origin/logo/API
```

### Dashboard
Cards: orders today, pending, processing, shipped, revenue today. Bar chart: orders by source. Recent orders table.

### Order create UX (minimal clicks)
- Phone field → autofill customer + last address if exists
- City typeahead (RajaOngkir cities, cached)
- Add product rows from product picker → auto weight + price
- Courier select → auto-fetch services → pick service → fills shipping_cost + ETA
- Source/campaign/ref fields collapsible
- Save → status=Pending

### Shipping label (100×150 mm thermal)
- CSS `@page { size: 100mm 150mm; margin: 0 }`, print stylesheet hides chrome
- Layout: logo + courier badge (top), barcode (CODE128 of tracking), resi text, sender block, receiver block (large), items table, order_number, QR (order_number), routing code, insurance flag
- Single-order print from order detail
- Bulk print: `/labels` page; select multiple → renders all labels, one per page
- Preview = same component rendered on screen scaled

### Settings
- Sender name, phone, city; warehouse origin (RajaOngkir city_id + type city/subdistrict); logo upload (Cloud storage)
- RajaOngkir API key handled via secret (not in UI)

### Secrets
- `RAJAONGKIR_API_KEY` — added via add_secret after Cloud is enabled (I'll ask for the key + origin city_id then)

### Deferred (not in v1)
Finance, Expenses, Discounts, Inventory adjustments, Reports/Analytics, CSV export, COD risk scoring. Hooks/fields stay in schema where cheap so they can be added later without migration churn.

### Build order
1. Enable Cloud, add RajaOngkir secret + origin settings
2. Migrations (roles, products, customers, orders, order_items, settings, cities cache)
3. Auth + protected layout + sidebar shell
4. Products & Customers CRUD
5. Server fns: shipping cost + city search; seed cities
6. Orders: list, create form with RajaOngkir integration, detail/edit, status flow, bulk status
7. Label component + single/bulk print routes
8. Dashboard
9. Shipping tracking page + Settings page

After plan approval I'll enable Cloud, then ask for the RajaOngkir API key and your warehouse origin city.