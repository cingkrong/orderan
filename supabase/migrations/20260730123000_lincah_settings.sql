-- Add Lincah.id configuration fields to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS lincah_api_key text DEFAULT 'oYeiIJkYFMctQebMQOZfOJYNbHkUzShD',
ADD COLUMN IF NOT EXISTS lincah_partner_id text DEFAULT '6a4617ceb8fd8dd8aa41906e',
ADD COLUMN IF NOT EXISTS lincah_env text DEFAULT 'development';
