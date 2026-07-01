
-- 1) product_variants table
CREATE TABLE public.product_variants (
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
