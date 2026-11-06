# Epsilon War AP Tracker

Telegram bot and web dashboard for tracking ability points and calculating equipment stats.

## Run locally

**Prerequisites:** Node.js and npm.

1. Install dependencies: `npm ci`.
2. Copy `.env.example` to `.env` and set `TELEGRAM_BOT_TOKEN` to connect your bot. Leave it empty to use the web simulator.
3. Run `npm run dev` and open `http://localhost:3000`.

## Deploy with Node.js

1. Run `npm ci` and `npm run build`.
2. Configure `TELEGRAM_BOT_TOKEN` and `DASHBOARD_PASSWORD` in the deployment environment.
3. Start the server with `NODE_ENV=production npm start`. The server listens on port 3000.
4. Keep the `equip/data/` and `database/` directories alongside `dist/` and persist the root `data/` directory for battle and equipment profiles. Start the server from the repository root.
5. Run one bot instance per token because Telegram updates are received through long polling.

## Калькулятор статов (`/equip`)

Функционал перенесён из [heckertopgg/equip_bot](https://github.com/heckertopgg/equip_bot) (MIT, см. `equip/data/LICENSE`).

- `/equip` — меню калькулятора: экипировка (10 слотов, заточка +0…+10, камни хаоса для оружия/шлема/сапог), расы, сброс.
- `/stats` — рассчитанные характеристики, включая бонусы комплектов.
- Бафы: еда, таланты, клановые навыки (+0…+11%), параметры героя, звания, прочие (комплимент, карма, тыква, ёлка, снеговик).
- Поиск предмета: кнопка «🔎 Поиск», затем отправьте часть названия. Для кнопки «Inline-поиск» включите inline mode у бота в @BotFather.

Код: `equip/calculator.ts` (формулы и данные), `equip/bot.ts` (меню Telegram), предметы в `equip/data/*.json`.
Профили игроков хранятся в `data/equip.json` (по Telegram user id).


## Shared equipment storage on Render

Set `DATABASE_URL` in Render's Environment settings to the supplied app-role connection string. Use the Supabase **session** pooler on port **5432**, without SSL query parameters; the app verifies TLS with the bundled Supabase CA. The project schema is in `database/schema.sql`; it requires an `ap_bot_app` login created with a private password. Never put the personal Supabase access token in Render or the repository.

With `DATABASE_URL`, every equipment interaction reads and saves the profile and pending input in a database transaction. Existing local profiles are imported on first use only when the database has no profile for that user. The Telegram token determines the storage namespace. The bot holds a PostgreSQL session lock while polling. Additional instances stay on standby and retry; loss of the owning connection cancels polling. Polling offsets survive restarts. Equipment replies are saved atomically with the Telegram update ID, so a delivery retry does not apply a toggle twice. The most recent 10,000 update receipts are retained. Without `DATABASE_URL`, the original local-file behavior remains.

For the first rollout, back up `data/equip.json` from the current Render instance if you need existing loadouts, then suspend old bot services. Configure `DATABASE_URL` and deploy this version before resuming the intended service. Old versions and other deployments without the same database do not participate in the lock and must be stopped. On Render Free, local files can disappear on restart; import the backup before resuming if needed.

Equipment persistence and polling are covered by `TEST_DATABASE_URL=... npm run test:integration` against a test project with the schema installed. Integration tests create isolated test namespaces and remove them afterward. The ordinary `npm test` runs equipment search checks without a database.

Battle state and dashboard settings still use local `data/database.json`; this database integration covers equipment profiles and Telegram polling only. Render Free can still sleep: the database lock does not keep the service awake.

The bundled CA is Supabase Root 2021 CA, downloaded from `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.
