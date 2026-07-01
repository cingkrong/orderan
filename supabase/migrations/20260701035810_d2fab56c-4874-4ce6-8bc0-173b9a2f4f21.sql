
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

CREATE POLICY "Staff read expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff insert expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Staff update expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));
CREATE POLICY "Admin delete expenses" ON public.expenses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

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
