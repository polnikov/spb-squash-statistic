# SPB Squash Statistic

Статистика сквош-лиги: официальные рейтинги, дивизионы, этапы, Iron Man,
профили игроков со Strength Rating (Elo) и head-to-head. Результаты этапов
импортируются из RankedIn через админку `/manager`.

Устанавливается как PWA (standalone, домашний экран). Офлайн-режима пока нет —
service worker не подключён.

## Возможности

- **Рейтинг** — таблица дивизионов по официальным очкам RankedIn (`points`).
- **Дивизионы / Этапы** — сводки и результаты, замороженные первые колонки при
  боковом скролле на мобиле.
- **Iron Man** — время на корте за половину сезона.
- **Игроки** — лидерборд по Strength Rating + карусель, профиль с графиками
  (ECharts), head-to-head, аналитика (skillIndex / formIndex).
- **Strength Rating** — opponent-aware Elo: сила игрока с учётом силы соперника,
  сквозь дивизионы. Глобальный хронологический пересчёт по всей истории матчей;
  результат кэшируется на `players`, аудит — в `player_rating_history`.
- **Админка `/manager`** — импорт этапов из RankedIn, очки, ручные правки.

## Стек

| Слой | Технология |
| --- | --- |
| App | Next.js 14 (App Router) + TypeScript |
| БД | PostgreSQL + Drizzle ORM / Drizzle-Kit |
| UI | Tailwind CSS v4, `next-themes` (dark по умолчанию), lucide-react |
| Графики | Apache ECharts (`echarts` + `echarts-for-react`) |
| Таблицы | TanStack Table |
| Формы | React Hook Form + Zod (админка) |
| Тесты | Vitest |
| Деплой | GitHub Actions → GHCR → self-hosted (Docker + Caddy) |

Цветовые роли и M3-токены (тёмная тема, акцент `#f472b6`) — в
`src/app/globals.css`. `MaterialExpressiveTheme` — обёртка `next-themes`,
держащая dark как класс по умолчанию.

## Требования

Node 18+, Docker, Docker Compose.

## Быстрый старт

```bash
cp .env.example .env                              # креды БД/Redis, ADMIN_*
docker compose -f docker-compose.dev.yml up -d    # postgres + redis
npm install
npm run db:push                                   # схема в БД (dev)
npm run dev                                        # http://localhost:3000
```

Наполнить статистику (агрегаты, skillIndex/formIndex, Strength Rating) можно
через импорт этапа в `/manager` — он пересчитывает всё автоматически. Полный
пересчёт по всей истории:

```bash
npx tsx src/scripts/backfill-stats.ts
```

## Скрипты

- `dev` / `build` / `start` — Next.js.
- `lint` — `next lint`; `typecheck` — `tsc --noEmit`.
- `test` / `test:watch` — Vitest.
- `db:generate` — SQL-миграции из схемы; `db:migrate` — применить их.
- `db:push` — синхронизировать схему напрямую (dev); `db:studio` — Drizzle Studio.

## Структура

```
src/
  app/
    (app)/            # маршруты: / (Рейтинг), stages, divisions, ironman, players, manager
    api/health/       # health-check для деплоя
    manifest.ts       # web-манифест (PWA)
    globals.css       # M3-токены, тёмная тема, keyframes
  components/         # UI и вью (таблицы, профиль, H2H, лидерборд)
  lib/
    db/               # drizzle: schema.ts, клиент, загрузчики
    stats/            # движок Strength Rating + пересчёт агрегатов
    parsing/          # парсер RankedIn
  scripts/            # backfill-stats.ts (полный пересчёт)
drizzle/              # сгенерированные SQL-миграции
```

## Локальная full-stack сборка

```bash
docker compose -f docker-compose.dev.yml --profile full up -d --build
```

Поднимает локально собранные `app` и `caddy` (авто-TLS) поверх `postgres` и
`redis`. Домен — в `Caddyfile`.

## Деплой (GitHub Actions → GHCR → self-hosted)

- **`build.yml`** — на push в `main`: тесты (`tsc --noEmit`, `next lint`,
  unit-тесты Vitest — интеграционные исключены), затем сборка и пуш образа в
  GHCR (`ghcr.io/<owner>/<repo>:latest` и `:sha-<sha>`, `linux/amd64`).
- **`deploy.yml`** — после сборки, на раннере `[self-hosted, home-server]`:
  `cd /opt/docker/bbr` → `docker compose pull` → `up -d --remove-orphans` →
  prune → health-check `GET /api/health`. Миграции применяются в `entrypoint.sh`
  контейнера `app` (`drizzle-kit migrate`) при старте.

TLS и ingress на сервере — хостовый Caddy (контейнер). Прод-`docker-compose.yml`
свой Caddy не поднимает: `app` (`bbr-app`) входит во внешнюю сеть Caddy
(`CADDY_NETWORK`), Caddy проксирует на `bbr-app:3000`. Блок сайта для
**bbrsquashspb.ohmyapps.xyz** — в
[`deploy/caddy.bbrsquashspb.conf`](deploy/caddy.bbrsquashspb.conf).

### Разовая настройка сервера

1. Каталог `/opt/docker/bbr` с `docker-compose.yml` и `.env`: задать
   `GITHUB_REPOSITORY`, `IMAGE_TAG`, `POSTGRES_*`, `ADMIN_USERNAME`,
   `ADMIN_PASSWORD_HASH` (bcrypt), `APP_URL`.
2. `docker login ghcr.io` токеном с `read:packages` (образ приватный).
3. Зарегистрировать self-hosted раннер с метками `self-hosted, home-server`.
4. Сверить `CADDY_NETWORK` в `.env` с реальной сетью Caddy, вставить
   `deploy/caddy.bbrsquashspb.conf` в серверный Caddyfile, перезагрузить Caddy.
