# ББР Сквош — статистика лиги

Веб-приложение для статистики сквош-лиги: рейтинги, дивизионы, этапы, Iron Man,
карточки игроков и парсинг результатов этапов из RankedIn.

## Стек

| Слой | Технология |
| --- | --- |
| App | Next.js (App Router) + TypeScript |
| БД | PostgreSQL (Docker) + Drizzle ORM + Drizzle-Kit |
| Прокси | Caddy (авто-TLS) |
| Графики | Apache ECharts (`echarts` + `echarts-for-react`) |
| UI | Tailwind CSS + shadcn/ui (Radix) + lucide-react |
| Дизайн-система | текущий дизайн + Material 3 Expressive → `MaterialExpressiveTheme` |
| Таблицы | TanStack Table |
| Формы/валидация | React Hook Form + Zod |
| Тесты | Vitest (+ Testing Library) |

## Быстрый старт

```bash
cp .env.example .env                         # проверьте креды БД/Redis
docker compose -f docker-compose.dev.yml up -d   # поднимет postgres + redis
npm install
npm run db:push                              # применить схему к БД (dev)
npm run dev                                  # http://localhost:3000
```

## Скрипты

- `dev` / `build` / `start` — Next.js.
- `typecheck` — `tsc --noEmit`.
- `test` / `test:watch` — Vitest.
- `db:generate` — сгенерировать SQL-миграции из схемы.
- `db:migrate` — применить миграции.
- `db:push` — синхронизировать схему напрямую (для разработки).
- `db:studio` — Drizzle Studio.

## Структура

```
src/
  app/                 # маршруты App Router + globals.css
  components/
    providers/         # MaterialExpressiveTheme (тема/мотив)
    ui/                # примитивы shadcn/ui
  lib/
    db/                # drizzle: schema.ts, index.ts (клиент)
    utils.ts           # cn() и пр.
drizzle/               # сгенерированные SQL-миграции
```

## Локальный full-stack (сборка образа)

```bash
docker compose -f docker-compose.dev.yml --profile full up -d --build
```

Поднимает локально собранные `app` и `caddy` (авто-TLS) поверх
`postgres`/`redis`. Домен задаётся в `Caddyfile`.

## Деплой (GitHub Actions → GHCR → self-hosted)

CI/CD зеркалит модель Personal_event_tracker:

- **`.github/workflows/build.yml`** — на push в `main` (и вручную): job `test`
  (`npm ci`, `tsc --noEmit`, `next lint`, unit-тесты Vitest; интеграционные
  исключены) → job `build` собирает и пушит образ в GHCR:
  `ghcr.io/<owner>/<repo>:latest` и `:sha-<sha>` (`linux/amd64`, gha-кэш).
- **`.github/workflows/deploy.yml`** — после успешной сборки (или вручную)
  на self-hosted раннере `[self-hosted, home-server]`: `cd /opt/docker/bbr` →
  `docker compose pull` → `up -d --remove-orphans` → prune → health-check
  `GET /api/health`. Миграции БД применяются автоматически в `entrypoint.sh`
  контейнера `app` (`drizzle-kit migrate`) при старте.

TLS/ingress на сервере — уже работающий хостовый **Caddy** (контейнер). Прод-
`docker-compose.yml` свой Caddy не поднимает: `app` (контейнер `bbr-app`) входит
во внешнюю docker-сеть Caddy (`CADDY_NETWORK`, по умолчанию `caddy`), Caddy
проксирует на `bbr-app:3000`. Блок сайта для домена
**bbrsquashspb.ohmyapps.xyz** — в [`deploy/caddy.bbrsquashspb.conf`](deploy/caddy.bbrsquashspb.conf)
(вставить в серверный Caddyfile). CSP там разрешает `https://rsms.me` (шрифт
Inter из `globals.css`); админка живёт на `/manager`, поэтому `@hidden`-правило
её не блокирует. (Свой Caddy остаётся только в `docker-compose.dev.yml` для локали.)

### Разовая настройка сервера

1. Каталог `/opt/docker/bbr` с `docker-compose.yml` (из репо) и `.env`
   (из `.env.example`): задать `GITHUB_REPOSITORY`, `IMAGE_TAG`,
   `POSTGRES_*`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (bcrypt), `APP_URL`.
2. Аутентификация в GHCR для pull приватного образа
   (`docker login ghcr.io` токеном с `read:packages`).
3. Зарегистрировать self-hosted GitHub Actions раннер с метками
   `self-hosted, home-server`.
4. Убедиться, что `CADDY_NETWORK` в `.env` = реальная сеть Caddy, и вставить блок
   `deploy/caddy.bbrsquashspb.conf` в серверный Caddyfile (proxy на `bbr-app:3000`),
   перезагрузить Caddy.

## Дизайн

Компонентная M3-библиотека — `@material/web` (официальные Material 3
web-components на Lit). Тема и регистрация компонентов — в
`MaterialExpressiveTheme`; M3-токены (цвет/форма/мотив, dark, сид —
бренд-зелёный) в `src/styles/m3-theme.css`. Компоненты Lit регистрируются
только на клиенте (SSR отдаёт `<md-*>` теги, апгрейд — после гидрации).

Tailwind + shadcn/ui (Radix) используются для разметки и собственных
компонентов; их токены — в `src/app/globals.css` и `tailwind.config.ts`.
Референс-дизайн — мокапы в `BBR design/` и `mockups/`.

> Примечание: `@material/web` в режиме поддержки, и набор «Expressive»-компонентов
> в web-версии пока неполный — Expressive выражается через токены формы и мотива.
