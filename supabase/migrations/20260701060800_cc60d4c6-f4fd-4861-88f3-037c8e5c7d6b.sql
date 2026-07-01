ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS size text;