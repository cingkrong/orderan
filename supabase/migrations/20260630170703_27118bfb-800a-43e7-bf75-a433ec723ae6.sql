
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS origin_subdistrict_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS origin_label text NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS destination_subdistrict_id text,
  ADD COLUMN IF NOT EXISTS destination_label text;

DROP TABLE IF EXISTS public.rajaongkir_cities;
