<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b4008525-0293-45d9-be08-e6b17169535e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Калькулятор статов (`/equip`)

Функционал перенесён из [heckertopgg/equip_bot](https://github.com/heckertopgg/equip_bot) (MIT, см. `equip/data/LICENSE`).

- `/equip` — меню калькулятора: экипировка (10 слотов, заточка +0…+10, камни хаоса для оружия/шлема/сапог), расы, сброс.
- `/stats` — рассчитанные характеристики, включая бонусы комплектов.
- Бафы: еда, таланты, клановые навыки (+0…+11%), параметры героя, звания, прочие (комплимент, карма, тыква, ёлка, снеговик).
- Поиск предмета: кнопка «🔎 Поиск», затем отправьте часть названия. Для кнопки «Inline-поиск» включите inline mode у бота в @BotFather.

Код: `equip/calculator.ts` (формулы и данные), `equip/bot.ts` (меню Telegram), предметы в `equip/data/*.json`.
Профили игроков хранятся в `data/equip.json` (по Telegram user id).
