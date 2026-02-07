-- Fix missing columns in feed_sources table
-- Run this with: docker-compose exec postgres psql -U huntsphere_user -d huntsphere_db -f /fix_database.sql
-- Or connect to PostgreSQL and run these commands manually

-- Add refresh_interval_minutes column
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS refresh_interval_minutes INTEGER;

-- Add auto_fetch_enabled column
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS auto_fetch_enabled BOOLEAN DEFAULT true;

-- Add high_fidelity column
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS high_fidelity BOOLEAN DEFAULT false;

-- Verify the columns were added
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'feed_sources';

-- Add query versioning columns (2026-01-28)
DO $$ 
BEGIN
    -- Add query_version to hunts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hunts' AND column_name = 'query_version') THEN
        ALTER TABLE hunts ADD COLUMN query_version INTEGER DEFAULT 1;
    END IF;
    
    -- Add query_version to hunt_executions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hunt_executions' AND column_name = 'query_version') THEN
        ALTER TABLE hunt_executions ADD COLUMN query_version INTEGER DEFAULT 1;
    END IF;
    
    -- Add query_snapshot to hunt_executions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hunt_executions' AND column_name = 'query_snapshot') THEN
        ALTER TABLE hunt_executions ADD COLUMN query_snapshot TEXT;
    END IF;
END $$;

-- Set defaults for existing rows
UPDATE hunts SET query_version = 1 WHERE query_version IS NULL;
UPDATE hunt_executions SET query_version = 1 WHERE query_version IS NULL;
