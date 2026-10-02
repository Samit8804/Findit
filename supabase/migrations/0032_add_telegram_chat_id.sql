-- Add telegram_chat_id column for Telegram webhook session binding
alter table public.phone_verification_sessions
add column if not exists telegram_chat_id text;

-- Index for faster lookup by chat_id
create index if not exists idx_phone_verification_sessions_chat_id
  on public.phone_verification_sessions (telegram_chat_id);