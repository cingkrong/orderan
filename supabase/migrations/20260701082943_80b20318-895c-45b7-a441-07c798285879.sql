
-- ============ stock_movements ============
CREATE TABLE public.stock_movements (
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
CREATE POLICY "Staff manage stock_movements" ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- ============ order_history ============
CREATE TABLE public.order_history (
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
