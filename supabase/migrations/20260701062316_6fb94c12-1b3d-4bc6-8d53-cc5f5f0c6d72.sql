
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
