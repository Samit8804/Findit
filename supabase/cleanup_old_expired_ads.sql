-- Optional: Cleanup old expired ads (delete after 30 days of being expired)
-- Run this if you want to permanently delete very old expired ads

create or replace function public.cleanup_old_expired_ads()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  -- Delete ads that have been expired for more than 30 days
  -- This keeps the database clean while preserving expired ads for 30 days
  delete from public.ads
  where status = 'expired'
    and expires_at is not null
    and expires_at < now() - interval '30 days';
  
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Schedule cleanup to run daily at 3 AM (optional)
-- select cron.schedule('cleanup-old-expired-ads-daily', '0 3 * * *', $$ select public.cleanup_old_expired_ads(); $$);