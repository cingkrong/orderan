
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
