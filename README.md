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
4. Keep the `equip/data/` directory alongside `dist/` and persist the root `data/` directory for battle and equipment profiles. Start the server from the repository root.
5. Run one bot instance per token because Telegram updates are received through long polling.

## Калькулятор статов (`/equip`)

Функционал перенесён из [heckertopgg/equip_bot](https://github.com/heckertopgg/equip_bot) (MIT, см. `equip/data/LICENSE`).

- `/equip` — меню калькулятора: экипировка (10 слотов, заточка +0…+10, камни хаоса для оружия/шлема/сапог), расы, сброс.
- `/stats` — рассчитанные характеристики, включая бонусы комплектов.
- Бафы: еда, таланты, клановые навыки (+0…+11%), параметры героя, звания, прочие (комплимент, карма, тыква, ёлка, снеговик).
- Поиск предмета: кнопка «🔎 Поиск», затем отправьте часть названия. Для кнопки «Inline-поиск» включите inline mode у бота в @BotFather.

Код: `equip/calculator.ts` (формулы и данные), `equip/bot.ts` (меню Telegram), предметы в `equip/data/*.json`.
Профили игроков хранятся в `data/equip.json` (по Telegram user id).

