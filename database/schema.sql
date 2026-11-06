-- Run once as the project database administrator. The app uses a separate login.
create schema if not exists ap_bot;
revoke all on schema ap_bot from public, anon, authenticated;
create table if not exists ap_bot.equipment (
  namespace text not null,
  user_id text not null,
  state jsonb not null,
  primary key (namespace, user_id)
);
create table if not exists ap_bot.polling (
  namespace text primary key,
  next_offset bigint not null default 0
);
create table if not exists ap_bot.receipts (
  namespace text not null,
  update_id bigint not null,
  user_id text not null,
  result jsonb not null,
  primary key (namespace, update_id)
);
alter table ap_bot.receipts enable row level security;
alter table ap_bot.equipment enable row level security;
alter table ap_bot.polling enable row level security;
-- Create ap_bot_app LOGIN with a generated password before applying these grants.
grant usage on schema ap_bot to ap_bot_app;
grant select, insert, update, delete on ap_bot.equipment, ap_bot.polling to ap_bot_app;
create policy app_equipment on ap_bot.equipment to ap_bot_app using (true) with check (true);
create policy app_polling on ap_bot.polling to ap_bot_app using (true) with check (true);

grant select, insert, delete on ap_bot.receipts to ap_bot_app;
create policy app_receipts on ap_bot.receipts to ap_bot_app using (true) with check (true);
