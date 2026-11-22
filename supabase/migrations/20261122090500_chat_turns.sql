-- Astro chat limits (docs/18, section 5; docs/21).
--
-- One row per question put to Astro, with what it cost. Only numbers and ids are kept, never the
-- question or the answer. Free questions are counted per browser (a random id in a cookie) and
-- per network (a keyed hash of the address, never the address); paid questions per account,
-- against the chat allowance that each paid report adds.
--
-- This table matches backend/app/store/chat.py. Costs are in millionths of a US dollar, the
-- currency the AI provider bills in.

create table sidera.chat_turns (
  id uuid primary key,
  kind text not null check (kind in ('free', 'paid')),
  -- Paid questions: the account. Deleting the account deletes its chat usage.
  user_id uuid references sidera.users (id) on delete cascade,
  -- Free questions: the random id in the chat cookie, and a keyed hash of the network address.
  browser text check (char_length(browser) <= 64),
  network text check (char_length(network) <= 64),
  -- Free questions: when this browser's week began (its first question of that week).
  week_start timestamptz,
  created_at timestamptz not null,
  -- When the AI service took the question up, and whether it wrote the follow-up buttons.
  started_at timestamptz,
  suggested boolean not null default false,
  -- What the AI provider reported, added up over the answer and its follow-up buttons.
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  cached_tokens bigint not null default 0 check (cached_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  reported_at timestamptz,
  check (
    (kind = 'free' and browser is not null and user_id is null and week_start is not null)
    or (kind = 'paid' and user_id is not null and browser is null and network is null)
  )
);
create index chat_turns_browser on sidera.chat_turns (browser, created_at) where browser is not null;
create index chat_turns_network on sidera.chat_turns (network, created_at) where network is not null;
create index chat_turns_user on sidera.chat_turns (user_id, created_at) where user_id is not null;
create index chat_turns_kind on sidera.chat_turns (kind, created_at);

alter table sidera.chat_turns enable row level security;

revoke all on sidera.chat_turns from public, anon, authenticated, service_role;
