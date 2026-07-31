-- MAULARIS OMS Complete Database Schema Migration

-- ==========================================
-- MIGRATION FILE: 20260630163205_eaada5d6-16b2-4949-b1ac-8b85368d839f.sql
-- ==========================================


-- Roles
DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'))
$$;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles readable by signed-in users" ON public.profiles;
CREATE POLICY "Profiles readable by signed-in users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile + grant admin role to first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  variant TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  weight_g INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage products" ON public.products;
CREATE POLICY "Staff manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  last_address JSONB,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage customers" ON public.customers;
CREATE POLICY "Staff manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_customers_updated ON public.customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Order status enum
CREATE TYPE public.order_status AS ENUM
  ('pending','confirmed','processing','shipped','completed','cancelled');

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  full_address TEXT NOT NULL,
  province TEXT,
  city TEXT,
  district TEXT,
  postal_code TEXT,
  destination_city_id TEXT,
  courier TEXT,
  service TEXT,
  tracking_number TEXT,
  status public.order_status NOT NULL DEFAULT 'pending',
  source TEXT,
  campaign TEXT,
  ref TEXT,
  weight_g INTEGER NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  eta TEXT,
  insurance BOOLEAN NOT NULL DEFAULT false,
  routing_code TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read orders" ON public.orders;
CREATE POLICY "Staff read orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff insert orders" ON public.orders;
CREATE POLICY "Staff insert orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff update orders" ON public.orders;
CREATE POLICY "Staff update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin delete orders" ON public.orders;
CREATE POLICY "Admin delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);

-- Auto-generate order_number
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
      lpad(nextval('public.order_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_orders_order_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  variant TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  weight_g INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage order items" ON public.order_items;
CREATE POLICY "Staff manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- Settings singleton
CREATE TABLE IF NOT EXISTS public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sender_name TEXT NOT NULL DEFAULT '',
  sender_phone TEXT NOT NULL DEFAULT '',
  sender_city TEXT NOT NULL DEFAULT '',
  sender_address TEXT NOT NULL DEFAULT '',
  origin_city_id TEXT NOT NULL DEFAULT '',
  origin_type TEXT NOT NULL DEFAULT 'city',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read settings" ON public.settings;
CREATE POLICY "Staff read settings" ON public.settings FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update settings" ON public.settings;
CREATE POLICY "Admin update settings" ON public.settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admin insert settings" ON public.settings;
CREATE POLICY "Admin insert settings" ON public.settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_settings_updated ON public.settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RajaOngkir cities cache
CREATE TABLE IF NOT EXISTS public.rajaongkir_cities (
  city_id TEXT PRIMARY KEY,
  province_id TEXT,
  province TEXT,
  type TEXT,
  city_name TEXT NOT NULL,
  postal_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rajaongkir_cities TO authenticated;
GRANT ALL ON public.rajaongkir_cities TO service_role;
ALTER TABLE public.rajaongkir_cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read cities" ON public.rajaongkir_cities;
CREATE POLICY "Staff read cities" ON public.rajaongkir_cities FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff write cities" ON public.rajaongkir_cities;
CREATE POLICY "Staff write cities" ON public.rajaongkir_cities FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE INDEX idx_cities_search ON public.rajaongkir_cities USING gin (to_tsvector('simple', city_name || ' ' || coalesce(province,'')));
CREATE INDEX idx_cities_name ON public.rajaongkir_cities(lower(city_name));

-- Update customer rollup on order changes
CREATE OR REPLACE FUNCTION public.update_customer_rollup()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET total_orders = sub.cnt,
        total_spent = sub.spent,
        last_address = jsonb_build_object(
          'full_address', NEW.full_address,
          'province', NEW.province,
          'city', NEW.city,
          'district', NEW.district,
          'postal_code', NEW.postal_code,
          'destination_city_id', NEW.destination_city_id
        )
    FROM (
      SELECT COUNT(*) cnt, COALESCE(SUM(total),0) spent
      FROM public.orders WHERE customer_id = NEW.customer_id
    ) sub
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_orders_customer_rollup ON auth.users;
CREATE TRIGGER trg_orders_customer_rollup
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_rollup();


-- ==========================================
-- MIGRATION FILE: 20260630163233_8da3a649-87c8-42c4-b68e-d597b28861ce.sql
-- ==========================================


REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_customer_rollup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;


-- ==========================================
-- MIGRATION FILE: 20260630170703_27118bfb-800a-43e7-bf75-a433ec723ae6.sql
-- ==========================================


ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS origin_subdistrict_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS origin_label text NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS destination_subdistrict_id text,
  ADD COLUMN IF NOT EXISTS destination_label text;

DROP TABLE IF EXISTS public.rajaongkir_cities;


-- ==========================================
-- MIGRATION FILE: 20260630170941_22aa8e6b-5cad-4e5c-a76e-5ac6d6bea6a7.sql
-- ==========================================


CREATE OR REPLACE FUNCTION public.update_customer_rollup()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET total_orders = sub.cnt,
        total_spent = sub.spent,
        last_address = jsonb_build_object(
          'full_address', NEW.full_address,
          'province', NEW.province,
          'city', NEW.city,
          'district', NEW.district,
          'postal_code', NEW.postal_code,
          'destination_city_id', NEW.destination_city_id,
          'destination_subdistrict_id', NEW.destination_subdistrict_id,
          'destination_label', NEW.destination_label
        )
    FROM (
      SELECT COUNT(*) cnt, COALESCE(SUM(total),0) spent
      FROM public.orders WHERE customer_id = NEW.customer_id
    ) sub
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END; $function$;


-- ==========================================
-- MIGRATION FILE: 20260701032338_9d63099d-044d-46a4-90d4-8e166155ae39.sql
-- ==========================================


ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_dropship boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dropship_name text,
  ADD COLUMN IF NOT EXISTS dropship_phone text;

CREATE OR REPLACE FUNCTION public.update_customer_rollup()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET total_orders = sub.cnt,
        total_spent = sub.spent,
        last_address = jsonb_build_object(
          'full_address', NEW.full_address,
          'province', NEW.province,
          'city', NEW.city,
          'district', NEW.district,
          'postal_code', NEW.postal_code,
          'destination_city_id', NEW.destination_city_id,
          'destination_subdistrict_id', NEW.destination_subdistrict_id,
          'destination_label', NEW.destination_label
        ),
        tags = CASE
          WHEN NEW.is_dropship AND NOT (COALESCE(c.tags, ARRAY[]::text[]) @> ARRAY['dropship'])
            THEN COALESCE(c.tags, ARRAY[]::text[]) || ARRAY['dropship']
          ELSE c.tags
        END
    FROM (
      SELECT COUNT(*) cnt, COALESCE(SUM(total),0) spent
      FROM public.orders WHERE customer_id = NEW.customer_id
    ) sub
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END; $function$;


-- ==========================================
-- MIGRATION FILE: 20260701034023_a590a061-8f43-4912-83f6-a523199a52f7.sql
-- ==========================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS label_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS label_print_count integer NOT NULL DEFAULT 0;

-- ==========================================
-- MIGRATION FILE: 20260701035810_d2fab56c-4874-4ce6-8bc0-173b9a2f4f21.sql
-- ==========================================


-- Products: HPP
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost numeric(12,2) NOT NULL DEFAULT 0;

-- Order items: snapshot cost
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS cost numeric(12,2) NOT NULL DEFAULT 0;

-- Orders: discount + marketplace fee
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketplace_fee numeric(12,2) NOT NULL DEFAULT 0;

-- Expenses category enum
DO $$ BEGIN
  CREATE TYPE public.expense_category AS ENUM ('ads','operational','salary','rent','packaging','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT current_date,
  category public.expense_category NOT NULL DEFAULT 'operational',
  subcategory text,
  source text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read expenses" ON public.expenses;
CREATE POLICY "Staff read expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff insert expenses" ON public.expenses;
CREATE POLICY "Staff insert expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff update expenses" ON public.expenses;
CREATE POLICY "Staff update expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin delete expenses" ON public.expenses;
CREATE POLICY "Admin delete expenses" ON public.expenses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

DROP TRIGGER IF EXISTS trg_expenses_updated ON public.expenses;
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- View: per-order P&L
CREATE OR REPLACE VIEW public.order_pnl
WITH (security_invoker = true)
AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.created_at,
  o.status,
  o.source,
  o.campaign,
  o.customer_id,
  o.subtotal,
  o.discount,
  o.marketplace_fee,
  o.shipping_cost,
  o.total,
  (o.subtotal - o.discount) AS revenue,
  COALESCE(ci.cogs, 0) AS cogs,
  ((o.subtotal - o.discount) - COALESCE(ci.cogs, 0) - o.marketplace_fee) AS gross_profit
FROM public.orders o
LEFT JOIN (
  SELECT order_id, SUM(cost * qty) AS cogs
  FROM public.order_items GROUP BY order_id
) ci ON ci.order_id = o.id;

GRANT SELECT ON public.order_pnl TO authenticated;


-- ==========================================
-- MIGRATION FILE: 20260701041350_dc7913e9-7db5-4a60-a50c-981e9f06c1cd.sql
-- ==========================================


-- 1) product_variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Default',
  sku TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  weight_g INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX product_variants_product_id_idx ON public.product_variants(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage variants"
  ON public.product_variants
  FOR ALL
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

DROP TRIGGER IF EXISTS product_variants_touch_updated_at ON public.product_variants;
CREATE TRIGGER product_variants_touch_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) order_items.variant_id
ALTER TABLE public.order_items
  ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- 3) Backfill: buat satu default variant per produk existing
INSERT INTO public.product_variants (product_id, label, sku, price, cost, weight_g, stock, is_default, sort_order)
SELECT
  p.id,
  COALESCE(NULLIF(p.variant, ''), 'Default'),
  p.sku,
  p.price,
  p.cost,
  p.weight_g,
  p.stock,
  true,
  0
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id
);


-- ==========================================
-- MIGRATION FILE: 20260701041820_5a27cfc8-5029-4f37-aff4-9fa1b995bec7.sql
-- ==========================================

ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ==========================================
-- MIGRATION FILE: 20260701041856_0bff662f-bf64-4ee2-a84f-05611e882155.sql
-- ==========================================


CREATE POLICY "auth read product images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "auth insert product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "auth update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "auth delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');


-- ==========================================
-- MIGRATION FILE: 20260701054152_2a89b606-3cf8-4a5c-b58b-581a21dc9d0e.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sender_name TEXT,
  sender_phone TEXT,
  address TEXT,
  origin_subdistrict_id TEXT,
  origin_label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read warehouses" ON public.warehouses;
CREATE POLICY "staff read warehouses" ON public.warehouses FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "staff manage warehouses" ON public.warehouses;
CREATE POLICY "staff manage warehouses" ON public.warehouses FOR ALL TO authenticated USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_warehouses_updated ON public.warehouses;
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.warehouses (name, sender_name, sender_phone, address, origin_subdistrict_id, origin_label, is_default)
SELECT COALESCE(NULLIF(s.sender_name,''), 'Gudang Utama'), s.sender_name, s.sender_phone, s.sender_address, s.origin_subdistrict_id, s.origin_label, true
FROM public.settings s LIMIT 1;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid','paid','partial','refunded'));


-- ==========================================
-- MIGRATION FILE: 20260701055722_5eab8ef2-b63d-424b-81f3-e06c1ad8abb4.sql
-- ==========================================


-- 1) Extend settings with active/custom couriers
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS active_couriers text[] NOT NULL DEFAULT ARRAY['jne','sicepat','jnt','pos','tiki','anteraja','ide','wahana'],
  ADD COLUMN IF NOT EXISTS custom_couriers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Shipping rate cache
CREATE TABLE IF NOT EXISTS public.shipping_rate_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_subdistrict_id text NOT NULL,
  destination_subdistrict_id text NOT NULL,
  weight_bucket int NOT NULL,
  couriers text NOT NULL,
  services jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (origin_subdistrict_id, destination_subdistrict_id, weight_bucket, couriers)
);

CREATE INDEX IF NOT EXISTS shipping_rate_cache_lookup_idx
  ON public.shipping_rate_cache (origin_subdistrict_id, destination_subdistrict_id, weight_bucket);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_rate_cache TO authenticated;
GRANT ALL ON public.shipping_rate_cache TO service_role;

ALTER TABLE public.shipping_rate_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read shipping cache"
  ON public.shipping_rate_cache FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can write shipping cache"
  ON public.shipping_rate_cache FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can update shipping cache"
  ON public.shipping_rate_cache FOR UPDATE
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can delete shipping cache"
  ON public.shipping_rate_cache FOR DELETE
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));


-- ==========================================
-- MIGRATION FILE: 20260701060800_cc60d4c6-f4fd-4861-88f3-037c8e5c7d6b.sql
-- ==========================================

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS size text;

-- ==========================================
-- MIGRATION FILE: 20260701062021_e8c2cd8d-a9d2-4d33-8c37-2378b07e2588.sql
-- ==========================================

ALTER TABLE public.product_variants DROP COLUMN IF EXISTS color;
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS size;


-- ==========================================
-- MIGRATION FILE: 20260701062316_6fb94c12-1b3d-4bc6-8d53-cc5f5f0c6d72.sql
-- ==========================================


ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'stock',
  ADD COLUMN IF NOT EXISTS wholesale_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wholesale_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS storefront_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_stock boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS dropship_price numeric NOT NULL DEFAULT 0;


-- ==========================================
-- MIGRATION FILE: 20260701082943_80b20318-895c-45b7-a441-07c798285879.sql
-- ==========================================


-- ============ stock_movements ============
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  delta integer NOT NULL,
  stock_before integer,
  stock_after integer,
  reason text NOT NULL,
  note text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_variant ON public.stock_movements(variant_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_order ON public.stock_movements(order_id);
CREATE INDEX idx_stock_movements_created ON public.stock_movements(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage stock_movements" ON public.stock_movements;
CREATE POLICY "Staff manage stock_movements" ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- ============ order_history ============
CREATE TABLE IF NOT EXISTS public.order_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_value text,
  to_value text,
  note text,
  meta jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_history_order ON public.order_history(order_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_history TO authenticated;
GRANT ALL ON public.order_history TO service_role;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage order_history" ON public.order_history;
CREATE POLICY "Staff manage order_history" ON public.order_history
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- ============ helper: adjust variant stock + log ============
CREATE OR REPLACE FUNCTION public.adjust_variant_stock(
  _variant_id uuid,
  _delta integer,
  _reason text,
  _order_id uuid,
  _note text
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_before integer;
  v_after integer;
  v_product uuid;
BEGIN
  IF _variant_id IS NULL OR _delta = 0 THEN RETURN; END IF;
  SELECT stock, product_id INTO v_before, v_product
    FROM public.product_variants WHERE id = _variant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_after := v_before + _delta;
  UPDATE public.product_variants SET stock = v_after, updated_at = now()
    WHERE id = _variant_id;
  UPDATE public.products
    SET stock = COALESCE((SELECT SUM(stock) FROM public.product_variants WHERE product_id = v_product), 0),
        updated_at = now()
    WHERE id = v_product;
  INSERT INTO public.stock_movements(product_id, variant_id, delta, stock_before, stock_after, reason, order_id, note, created_by)
    VALUES (v_product, _variant_id, _delta, v_before, v_after, _reason, _order_id, _note, auth.uid());
END; $$;

-- ============ order_items trigger: auto-adjust stock ============
CREATE OR REPLACE FUNCTION public.order_items_stock_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status order_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_status FROM public.orders WHERE id = NEW.order_id;
    IF v_status IS DISTINCT FROM 'cancelled' AND NEW.variant_id IS NOT NULL THEN
      PERFORM public.adjust_variant_stock(NEW.variant_id, -NEW.qty, 'order:item_added', NEW.order_id, NEW.name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.orders WHERE id = OLD.order_id;
    IF v_status IS DISTINCT FROM 'cancelled' AND OLD.variant_id IS NOT NULL THEN
      PERFORM public.adjust_variant_stock(OLD.variant_id, OLD.qty, 'order:item_removed', OLD.order_id, OLD.name);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT status INTO v_status FROM public.orders WHERE id = NEW.order_id;
    IF v_status IS DISTINCT FROM 'cancelled' THEN
      IF OLD.variant_id IS DISTINCT FROM NEW.variant_id THEN
        IF OLD.variant_id IS NOT NULL THEN
          PERFORM public.adjust_variant_stock(OLD.variant_id, OLD.qty, 'order:item_changed', NEW.order_id, OLD.name);
        END IF;
        IF NEW.variant_id IS NOT NULL THEN
          PERFORM public.adjust_variant_stock(NEW.variant_id, -NEW.qty, 'order:item_changed', NEW.order_id, NEW.name);
        END IF;
      ELSIF OLD.qty <> NEW.qty AND NEW.variant_id IS NOT NULL THEN
        PERFORM public.adjust_variant_stock(NEW.variant_id, OLD.qty - NEW.qty, 'order:qty_changed', NEW.order_id, NEW.name);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_order_items_stock ON public.order_items;
DROP TRIGGER IF EXISTS trg_order_items_stock ON auth.users;
CREATE TRIGGER trg_order_items_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_stock_trigger();

-- ============ orders trigger: status → stock + history ============
CREATE OR REPLACE FUNCTION public.orders_history_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_history(order_id, action, to_value, created_by)
      VALUES (NEW.id, 'created', NEW.status::text, auth.uid());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- status change → stock adjust + log
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.order_history(order_id, action, from_value, to_value, created_by)
        VALUES (NEW.id, 'status_changed', OLD.status::text, NEW.status::text, auth.uid());
      IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
        FOR r IN SELECT variant_id, qty, name FROM public.order_items WHERE order_id = NEW.id LOOP
          IF r.variant_id IS NOT NULL THEN
            PERFORM public.adjust_variant_stock(r.variant_id, r.qty, 'order:cancelled', NEW.id, r.name);
          END IF;
        END LOOP;
      ELSIF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
        FOR r IN SELECT variant_id, qty, name FROM public.order_items WHERE order_id = NEW.id LOOP
          IF r.variant_id IS NOT NULL THEN
            PERFORM public.adjust_variant_stock(r.variant_id, -r.qty, 'order:uncancelled', NEW.id, r.name);
          END IF;
        END LOOP;
      END IF;
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      INSERT INTO public.order_history(order_id, action, from_value, to_value, created_by)
        VALUES (NEW.id, 'payment_changed', OLD.payment_status, NEW.payment_status, auth.uid());
    END IF;

    IF COALESCE(OLD.tracking_number,'') IS DISTINCT FROM COALESCE(NEW.tracking_number,'') AND COALESCE(NEW.tracking_number,'') <> '' THEN
      INSERT INTO public.order_history(order_id, action, from_value, to_value, created_by)
        VALUES (NEW.id, 'tracking_set', OLD.tracking_number, NEW.tracking_number, auth.uid());
    END IF;

    IF COALESCE(OLD.label_print_count,0) < COALESCE(NEW.label_print_count,0) THEN
      INSERT INTO public.order_history(order_id, action, to_value, created_by)
        VALUES (NEW.id, 'label_printed', NEW.label_print_count::text, auth.uid());
    END IF;

    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_orders_history ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_history ON auth.users;
CREATE TRIGGER trg_orders_history
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_history_trigger();

-- ============ Backfill: deduct stock for existing non-cancelled orders that haven't been logged ============
-- Guard: only run if stock_movements is empty (fresh install of this feature)
DO $$
DECLARE
  r record;
BEGIN
  IF (SELECT COUNT(*) FROM public.stock_movements) = 0 THEN
    FOR r IN
      SELECT oi.variant_id, SUM(oi.qty)::int AS qty, oi.order_id, MIN(oi.name) AS name
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.status <> 'cancelled' AND oi.variant_id IS NOT NULL
      GROUP BY oi.variant_id, oi.order_id
    LOOP
      PERFORM public.adjust_variant_stock(r.variant_id, -r.qty, 'backfill:existing_order', r.order_id, r.name);
    END LOOP;
  END IF;
END $$;


-- ==========================================
-- MIGRATION FILE: 20260701155340_273b45c3-7338-426d-83ba-ab4ebc04045c.sql
-- ==========================================

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'g' CHECK (weight_unit IN ('g','kg'));

-- ==========================================
-- MIGRATION FILE: 20260730123000_lincah_settings.sql
-- ==========================================

-- Add Lincah.id configuration fields to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS lincah_api_key text DEFAULT 'oYeiIJkYFMctQebMQOZfOJYNbHkUzShD',
ADD COLUMN IF NOT EXISTS lincah_partner_id text DEFAULT '6a4617ceb8fd8dd8aa41906e',
ADD COLUMN IF NOT EXISTS lincah_env text DEFAULT 'development';


-- ==========================================
-- MIGRATION FILE: 20260730133000_lincah_couriers_setting.sql
-- ==========================================

-- Add lincah_couriers array to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS lincah_couriers text[] DEFAULT '{"jne","sap","ninja","sicepat","jnt","anteraja","lion","ide","pos","wahana"}'::text[];


