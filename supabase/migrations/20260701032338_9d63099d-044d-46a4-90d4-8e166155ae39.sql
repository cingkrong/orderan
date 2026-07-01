
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_dropship boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dropship_name text,
  ADD COLUMN IF NOT EXISTS dropship_phone text;

CREATE OR REPLACE FUNCTION public.update_customer_rollup()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
          'destination_city_id', NEW.destination_city_id,
          'destination_subdistrict_id', NEW.destination_subdistrict_id,
          'destination_label', NEW.destination_label
        ),
        tags = CASE
          WHEN NEW.is_dropship AND NOT (COALESCE(c.tags, ARRAY[]::text[]) @> ARRAY['dropship'])
            THEN COALESCE(c.tags, ARRAY[]::text[]) || ARRAY['dropship']
          ELSE c.tags
        END
    FROM (
      SELECT COUNT(*) cnt, COALESCE(SUM(total),0) spent
      FROM public.orders WHERE customer_id = NEW.customer_id
    ) sub
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END; $function$;
