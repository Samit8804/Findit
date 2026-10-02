with duplicate_windows as (
  select
    user_id,
    phone,
    method,
    window_start,
    min(id) as keep_id,
    sum(attempt_count)::int as attempt_count
  from public.verification_rate_limits
  group by user_id, phone, method, window_start
  having count(*) > 1
)
update public.verification_rate_limits as rate_limit
set attempt_count = duplicate_windows.attempt_count
from duplicate_windows
where rate_limit.id = duplicate_windows.keep_id;

with
    ranked_windows as (
        select id, row_number() over (
                partition by
                    user_id, phone, method, window_start
                order by id
            ) as row_number
        from public.verification_rate_limits
    )
delete from public.verification_rate_limits as rate_limit using ranked_windows
where
    rate_limit.id = ranked_windows.id
    and ranked_windows.row_number > 1;

create unique index if not exists idx_verification_rate_limits_unique_window on public.verification_rate_limits (
    user_id,
    phone,
    method,
    window_start
);