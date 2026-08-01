-- Add label_paper_size column to settings table if not exists
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS label_paper_size text DEFAULT '100x150';
