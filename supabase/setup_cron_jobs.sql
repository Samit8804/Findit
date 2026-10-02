-- Run this AFTER enabling pg_cron extension in Supabase Dashboard
-- Go to: Supabase Dashboard > Database > Extensions > Enable "pg_cron"

-- Verify pg_cron is enabled
select * from pg_extension where extname = 'pg_cron';

-- If the above returns a row, pg_cron is enabled. Now set up the cron jobs:

-- 1. Expire due ads every 15 minutes
select cron.schedule(
  'expire-due-ads-every-15min',
  '*/15 * * * *',
  $$ select public.expire_due_ads(); $$
);

-- 2. Send expiry notifications hourly
select cron.schedule(
  'expiry-notifications-hourly',
  '0 * * * *',
  $$ select public.send_expiry_notifications(); $$
);

-- Verify jobs were created
select * from cron.job;