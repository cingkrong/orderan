
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.user_roles (
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

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by signed-in users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE public.products (
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
CREATE POLICY "Staff manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Customers
CREATE TABLE public.customers (
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
CREATE POLICY "Staff manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Order status enum
CREATE TYPE public.order_status AS ENUM
  ('pending','confirmed','processing','shipped','completed','cancelled');

-- Orders
CREATE TABLE public.orders (
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
CREATE POLICY "Staff read orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff insert orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Admin delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
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
    NEW.order_number := '#' || lpad(nextval('public.order_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_orders_order_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- Order items
CREATE TABLE public.order_items (
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
CREATE POLICY "Staff manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- Settings singleton
CREATE TABLE public.settings (
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
CREATE POLICY "Staff read settings" ON public.settings FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Admin update settings" ON public.settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert settings" ON public.settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RajaOngkir cities cache
CREATE TABLE public.rajaongkir_cities (
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
CREATE POLICY "Staff read cities" ON public.rajaongkir_cities FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
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
CREATE TRIGGER trg_orders_customer_rollup
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_rollup();
