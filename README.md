# MAULARIS — Order & Shipping Management System

Modern web application for Order Management System (OMS) featuring real-time shipping calculation (Lincah.id API & JNE Flat Rate Mapping), thermal shipping label generator, customer CRM, financial/expense tracking, and mobile/tablet responsive design.

SYSTEM TYPE:

- Internal use only (single business)

- No customer login

- No public checkout form

- Admin-only dashboard

TECH STACK:

- Frontend: React / Next.js (modern UI, clean dashboard)

- Backend: Node.js (Express) or Laravel

- Database: MySQL or PostgreSQL

AUTHENTICATION:

- Admin login only (email + password)

- Role: admin, staff (optional)

========================================

CORE FEATURES

========================================

1. DASHBOARD

- Show:

  - Total orders today

  - Pending / processed / shipped

  - Total revenue

  - Orders by source (WA, Shopee, Ads, Affiliate)

----------------------------------------

2. ORDER MANAGEMENT

- Create order manually

- Edit & update order

- Status flow:

  - Pending

  - Confirmed

  - Processing

  - Shipped

  - Completed

  - Cancelled

FIELDS:

- order_number (auto generate)

- customer_name

- phone

- full_address

- province

- city

- district

- postal_code

- product_name

- variant

- quantity

- weight (gram)

- price

- shipping_cost (auto)

- courier (JNE, J&T, SiCepat)

- service (REG, YES, etc)

- tracking_number (resi)

- note

- source (WA / Shopee / FB Ads / TikTok / Affiliate)

- campaign

- ref

----------------------------------------

3. SHIPPING COST (RAJAONGKIR INTEGRATION)

Integrate RajaOngkir API:

- Endpoint: cost

- Use origin (fixed warehouse location)

- Destination from customer city

- Weight from order

FEATURES:

- Auto calculate shipping cost when:

  - city selected

  - courier selected

- Show available services:

  - REG

  - YES

  - OKE

- Select service → auto fill:

  - shipping_cost

  - estimated delivery

Store result in database.

----------------------------------------

4. SHIPPING LABEL GENERATOR

Create printable shipping label (A6 size):

CONTENT:

- Logo (top left)

- Courier (JNE REG, etc)

- Barcode (tracking number)

- Resi number

- Sender info:

  - name

  - phone

  - city

- Receiver info:

  - name

  - phone

  - full address

- Package details:

  - product name + variant

  - quantity

  - weight

  - insurance (yes/no)

  - notes

- Order number

- QR code (contains order_number)

- Routing code (manual field)

FEATURES:

- Preview label

- Print single

- Bulk print (multiple orders)

- Print optimized CSS

----------------------------------------

5. PRODUCT MANAGEMENT

- CRUD product

- Fields:

  - name

  - price

  - SKU

  - weight

  - stock

  - variant

----------------------------------------

6. CUSTOMER MANAGEMENT

- Auto create from orders

- Show:

  - order history

  - total spending

- Tag:

  - repeat buyer

  - COD risk

  - blacklist

----------------------------------------

7. SHIPPING MODULE

- Input tracking number

- Update shipping status

- Filter by courier

----------------------------------------

8. FINANCE

TRANSACTION:

- Income from orders

- Payment status

EXPENSE:

- Ads

- Operational

- Supplier

----------------------------------------

9. REPORTS & ANALYTICS

- Total orders

- Revenue

- Top products

- Orders by source

- Conversion tracking by source/ref

----------------------------------------

10. LABEL & TOOLS

- Generate barcode (use JsBarcode)

- Generate QR code (use qrcode.js)

- Bulk actions

----------------------------------------

DATABASE STRUCTURE:

TABLE: users

- id

- email

- password

- role

TABLE: orders

- id

- order_number

- customer_name

- phone

- address

- city

- province

- product

- variant

- qty

- weight

- price

- shipping_cost

- courier

- service

- tracking_number

- status

- source

- campaign

- ref

- created_at

TABLE: products

- id

- name

- price

- weight

- stock

- sku

TABLE: customers

- id

- name

- phone

- tags

TABLE: expenses

- id

- name

- amount

- category

----------------------------------------

UI/UX:

- Clean modern dashboard

- Sidebar navigation:

  Dashboard

  Orders

  Shipping

  Products

  Customers

  Discount

  Finance

  Reports

  Analytics

  Label

  Settings

  Inventory

- Fast, responsive

- Table filtering + search

----------------------------------------

ADVANCED FEATURES:

- Save last used address (auto-fill)

- Auto generate order number

- Bulk update status

- Export to CSV/Excel

- Mobile friendly (for warehouse use)

----------------------------------------

IMPORTANT:

- Optimize for speed & usability

- Minimal clicks for creating order

- Focus on internal operations

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://orderan.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d0c3c263-060e-438a-a05d-7f39f5890e19).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
