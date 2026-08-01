-- Migration: Add RLS policies for settings and shipping_rate_cache tables
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================
-- TABLE: settings
-- ============================================

-- Enable RLS (if not already)
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Allow authenticated read settings') THEN
    CREATE POLICY "Allow authenticated read settings"
      ON settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Allow authenticated users to INSERT settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Allow authenticated insert settings') THEN
    CREATE POLICY "Allow authenticated insert settings"
      ON settings FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users to UPDATE settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Allow authenticated update settings') THEN
    CREATE POLICY "Allow authenticated update settings"
      ON settings FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- TABLE: shipping_rate_cache
-- ============================================

-- Enable RLS (if not already)
ALTER TABLE IF EXISTS shipping_rate_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT cache
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipping_rate_cache' AND policyname = 'Allow authenticated read shipping cache') THEN
    CREATE POLICY "Allow authenticated read shipping cache"
      ON shipping_rate_cache FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Allow authenticated users to INSERT cache
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipping_rate_cache' AND policyname = 'Allow authenticated insert shipping cache') THEN
    CREATE POLICY "Allow authenticated insert shipping cache"
      ON shipping_rate_cache FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users to UPDATE cache
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipping_rate_cache' AND policyname = 'Allow authenticated update shipping cache') THEN
    CREATE POLICY "Allow authenticated update shipping cache"
      ON shipping_rate_cache FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- TABLE: orders (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Allow authenticated full access orders') THEN
      CREATE POLICY "Allow authenticated full access orders"
        ON orders FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- ============================================
-- TABLE: customers (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Allow authenticated full access customers') THEN
      CREATE POLICY "Allow authenticated full access customers"
        ON customers FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- ============================================
-- TABLE: products (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow authenticated full access products') THEN
      CREATE POLICY "Allow authenticated full access products"
        ON products FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- ============================================
-- TABLE: product_variants (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variants') THEN
    ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variants' AND policyname = 'Allow authenticated full access product_variants') THEN
      CREATE POLICY "Allow authenticated full access product_variants"
        ON product_variants FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- ============================================
-- TABLE: warehouses (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouses') THEN
    ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'warehouses' AND policyname = 'Allow authenticated full access warehouses') THEN
      CREATE POLICY "Allow authenticated full access warehouses"
        ON warehouses FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- ============================================
-- TABLE: expenses (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow authenticated full access expenses') THEN
      CREATE POLICY "Allow authenticated full access expenses"
        ON expenses FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;
