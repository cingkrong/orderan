ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS label_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS label_print_count integer NOT NULL DEFAULT 0;