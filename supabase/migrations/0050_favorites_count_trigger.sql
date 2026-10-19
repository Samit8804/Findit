-- ============================================================
-- FindIt — Favorites count trigger
-- Run AFTER 0049. Idempotent.
-- ============================================================

-- Function to update favorites_count on ads table
create or replace function public.update_favorites_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.ads set favorites_count = favorites_count + 1 where id = new.ad_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.ads set favorites_count = greatest(favorites_count - 1, 0) where id = old.ad_id;
    return old;
  end if;
  return null;
end;
$$;

-- Trigger on favorites table
drop trigger if exists trg_update_favorites_count on public.favorites;
create trigger trg_update_favorites_count
after insert or delete on public.favorites
for each row execute function public.update_favorites_count();