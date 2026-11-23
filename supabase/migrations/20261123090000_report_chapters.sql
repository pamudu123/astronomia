-- The AI chapters of a paid report, written once and kept with it (docs/17, section 6a).
--
-- A chapter written again would read differently, so the first text of each chapter is the one
-- the report keeps, on every device of the account. A report is named by the order that paid for
-- it: no birth details and no names here, only the chapter text.
--
-- This table matches backend/app/store/chapters.py.

create table sidera.report_chapters (
  order_id uuid not null references sidera.orders (id) on delete cascade,
  -- Orders outlive a deleted account (sales records); the chapters do not.
  user_id uuid not null references sidera.users (id) on delete cascade,
  language text not null check (language in ('en', 'si')),
  chapter_id text not null check (chapter_id ~ '^(chart|match)\.[a-z]+$'),
  text text not null check (char_length(text) between 1 and 8000),
  created_at timestamptz not null,
  primary key (order_id, language, chapter_id)
);
create index report_chapters_user on sidera.report_chapters (user_id);

alter table sidera.report_chapters enable row level security;

revoke all on sidera.report_chapters from public, anon, authenticated, service_role;
