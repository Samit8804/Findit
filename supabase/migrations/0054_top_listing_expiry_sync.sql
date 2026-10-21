-- Keep a Top Listing live for the same window as its paid placement.
-- Preserve a later existing ad expiry. Uses the immutable order snapshot,
-- not a price or ad-specific rule. Run AFTER 0053.

do $migration$
declare
  v_function regprocedure;
  v_definition text;
  v_old text;
  v_new text;
begin
  v_function := 'public.apply_paid_order_benefits(uuid,timestamp with time zone,boolean,boolean)'::regprocedure;
  v_definition := pg_get_functiondef(v_function);
  v_old := $find$          v_ad_applied := true;

          if v_type in ('featured', 'top') then$find$;
  v_new := $replace$          if v_type = 'top' then
            v_ad_target := greatest(coalesce(v_ad.expires_at, v_ends), v_ends);

            update public.ad_promotions
               set original_expiry = v_ad.expires_at,
                   extended_expiry = v_ad_target
             where order_id = ord.id;

            if v_ad.expires_at is distinct from v_ad_target then
              update public.ads
                 set expires_at = v_ad_target,
                     updated_at = now()
               where id = ord.ad_id;
            end if;
          end if;

          v_ad_applied := true;

          if v_type in ('featured', 'top') then$replace$;

  if strpos(v_definition, v_old) > 0 then
    if length(v_definition) - length(replace(v_definition, v_old, '')) > length(v_old) then
      raise exception 'Top Listing benefit insertion point is ambiguous';
    end if;
    execute replace(v_definition, v_old, v_new);
  elsif strpos(v_definition, 'v_ad_target := greatest(coalesce(v_ad.expires_at, v_ends), v_ends);') = 0 then
    raise exception 'Top Listing benefit insertion point was not found';
  end if;

  v_function := 'public.revoke_paid_order_benefits(uuid)'::regprocedure;
  v_definition := pg_get_functiondef(v_function);
  v_old := $find$  v_extension record;
begin$find$;
  v_new := $replace$  v_extension record;
  v_top_original_expiry timestamptz;
  v_top_active_expiry timestamptz;
begin$replace$;

  if strpos(v_definition, v_old) > 0 then
    v_definition := replace(v_definition, v_old, v_new);
  elsif strpos(v_definition, 'v_top_original_expiry timestamptz;') = 0 then
    raise exception 'Top Listing refund declaration point was not found';
  end if;

  v_old := $find$  update public.ad_promotions
     set status = 'cancelled'
   where order_id = ord.id
     and status in ('active', 'pending');

  perform public.refresh_featured_flags();$find$;
  v_new := $replace$  update public.ad_promotions
     set status = 'cancelled'
   where order_id = ord.id
     and status in ('active', 'pending');

  if ord.ad_id is not null
     and exists (
       select 1 from public.promotions p
       where p.id = ord.promotion_id and p.type = 'top'
     ) then
    select (array_agg(ap.original_expiry order by ap.starts_at, ap.order_id))[1]
      into v_top_original_expiry
    from public.ad_promotions ap
    join public.promotions p on p.id = ap.promotion_id
    where ap.ad_id = ord.ad_id
      and p.type = 'top';

    select max(ap.ends_at)
      into v_top_active_expiry
    from public.ad_promotions ap
    join public.promotions p on p.id = ap.promotion_id
    join public.orders o on o.id = ap.order_id
    where ap.ad_id = ord.ad_id
      and p.type in ('top', 'extension')
      and ap.status = 'active'
      and o.status = 'paid';

    update public.ads
       set expires_at = greatest(v_top_original_expiry, v_top_active_expiry),
           updated_at = now()
     where id = ord.ad_id
       and deleted_at is null
       and status in ('pending', 'approved');
  end if;

  perform public.refresh_featured_flags();$replace$;

  if strpos(v_definition, v_old) > 0 then
    if length(v_definition) - length(replace(v_definition, v_old, '')) > length(v_old) then
      raise exception 'Top Listing refund insertion point is ambiguous';
    end if;
    execute replace(v_definition, v_old, v_new);
  elsif strpos(v_definition, 'v_top_active_expiry') = 0 then
    raise exception 'Top Listing refund insertion point was not found';
  end if;
end;
$migration$;

-- Align already-paid active Top Listings with their existing placement windows.
-- Ordering by payment time preserves the original expiry and repeat-purchase behavior.
do $backfill$
declare
  r record;
  v_ad public.ads%rowtype;
  v_target timestamptz;
begin
  for r in
    select ap.id, ap.ad_id, ap.ends_at
    from public.ad_promotions ap
    join public.promotions p on p.id = ap.promotion_id
    join public.orders o on o.id = ap.order_id
    where p.type = 'top'
      and ap.status = 'active'
      and ap.ends_at > now()
      and ap.original_expiry is null
      and ap.extended_expiry is null
      and o.status = 'paid'
      and exists (
        select 1
        from public.payment_transactions pt
        where pt.order_id = o.id
          and pt.provider = o.provider
          and pt.provider_transaction_id = o.provider_payment_id
          and pt.status = 'success'
      )
    order by ap.ad_id, coalesce(o.paid_at, o.updated_at), o.id
  loop
    select * into v_ad
    from public.ads
    where id = r.ad_id
    for update;

    if v_ad.id is null
       or v_ad.deleted_at is not null
       or v_ad.status not in ('pending', 'approved')
       or (v_ad.expires_at is not null and v_ad.expires_at <= now()) then
      continue;
    end if;

    v_target := greatest(coalesce(v_ad.expires_at, r.ends_at), r.ends_at);

    update public.ad_promotions
       set original_expiry = v_ad.expires_at,
           extended_expiry = v_target
     where id = r.id
       and original_expiry is null
       and extended_expiry is null;

    if found and v_ad.expires_at is distinct from v_target then
      update public.ads
         set expires_at = v_target,
             updated_at = now()
       where id = r.ad_id;
    end if;
  end loop;
end;
$backfill$;

-- Repair verified Top Listing orders whose activation previously failed entirely.
do $repair$
declare
  r record;
begin
  for r in
    select o.id, coalesce(o.paid_at, o.updated_at) as effective_at
    from public.orders o
    join public.promotions p on p.id = o.promotion_id
    where p.type = 'top'
      and o.status = 'paid'
      and o.provider_payment_id is not null
      and o.ad_id is not null
      and exists (
        select 1
        from public.payment_transactions pt
        where pt.order_id = o.id
          and pt.provider = o.provider
          and pt.provider_transaction_id = o.provider_payment_id
          and pt.status = 'success'
      )
      and not exists (
        select 1
        from public.ad_promotions ap
        where ap.order_id = o.id
          and ap.status <> 'cancelled'
      )
    order by coalesce(o.paid_at, o.updated_at), o.id
  loop
    perform public.apply_paid_order_benefits(r.id, r.effective_at, false, true);
  end loop;
end;
$repair$;
