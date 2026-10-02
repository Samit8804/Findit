alter table public.phone_verification_sessions
add column if not exists telegram_chat_id text;

create index if not exists idx_phone_verification_sessions_telegram_chat on public.phone_verification_sessions (
    telegram_chat_id,
    created_at desc
)
where
    method = 'telegram'
    and status = 'pending';