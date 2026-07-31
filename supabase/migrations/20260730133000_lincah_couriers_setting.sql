-- Add lincah_couriers array to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS lincah_couriers text[] DEFAULT '{"jne","sap","ninja","sicepat","jnt","anteraja","lion","ide","pos","wahana"}'::text[];
