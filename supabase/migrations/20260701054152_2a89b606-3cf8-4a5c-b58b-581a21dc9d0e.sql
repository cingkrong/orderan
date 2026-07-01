CREATE TABLE public.warehouses (
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
CREATE POLICY "staff read warehouses" ON public.warehouses FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "staff manage warehouses" ON public.warehouses FOR ALL TO authenticated USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));
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
