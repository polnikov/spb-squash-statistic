# Аналитика (self-hosted Umami)

Счётчик посещений и событий. Свой инстанс рядом с приложением, данные никуда не уходят.

## Как это собрано

- `umami` + `umami-db` в `docker-compose.yml`. База отдельная от боевой: трафик счётчика не должен конкурировать с запросами лиги, а стек аналитики можно снести, не трогая данные лиги.
- Трекер отдаётся **со своего домена**: `next.config.mjs` проксирует `/u/script.js`, `/u/api/send`, `/u/recorder.js` и `/u/api/websites/:id/recorder` на `bbr-umami:3000`. Так надо, потому что CSP в `deploy/caddy.bbrsquashspb.conf` разрешает только `'self'` для `script-src` и `connect-src`, плюс сторонние домены аналитики режут блокировщики. Снипет из панели Umami со ссылкой на `analytics.ohmyapps.xyz` вставлять нельзя - его срежет CSP.
- Тег вставляет RSC-layout (`src/components/analytics/umami-script.tsx`). Нет `UMAMI_WEBSITE_ID` - нет тега: локально и в CI аналитика молчит.
- Конфиг читается в рантайме, а не через `NEXT_PUBLIC_*`: образ собирается в CI (`.github/workflows/build.yml`), `NEXT_PUBLIC_*` впеклись бы на этапе сборки, когда website ID ещё не существует.

## Первый запуск на сервере

1. В `/opt/docker/bbr/.env` добавить:

   ```
   UMAMI_POSTGRES_PASSWORD=<пароль БД аналитики>
   UMAMI_APP_SECRET=<openssl rand -hex 32>
   UMAMI_WEBSITE_ID=
   ```

2. Поднять аналитику: `docker compose up -d umami-db umami`. Миграции своей БД Umami накатывает сам при старте.
3. Добавить в Caddyfile сервера блок из `deploy/caddy.umami.conf` (панель на `analytics.ohmyapps.xyz`, A-запись домена должна вести на сервер), перезагрузить Caddy. Там же обновить блок приложения по `deploy/caddy.bbrsquashspb.conf`: `/u/*` выведен из зоны `5 POST/min` в свою зону, иначе счётчик упрётся в лимит.
4. Зайти на `https://analytics.ohmyapps.xyz`, войти как `admin` / `umami` и сразу сменить пароль: панель доступна из интернета, дефолтная пара общеизвестна.
5. Websites → Add website. Domain - боевой домен приложения (`bbrsquashspb.ohmyapps.xyz`). Скопировать **Website ID**.
6. Вписать ID в `UMAMI_WEBSITE_ID` в `.env`, затем `docker compose up -d app`. Тег появится в HTML сразу после рестарта, пересборка образа не нужна.

Проверка: открыть сайт, в DevTools Network должны быть `200` на `/u/script.js` и `202` на `/u/api/send`.

## Запись сессий

Тег `recorder.js` идёт в том же `UmamiScript` и с тем же website ID, отдельной переменной нет. Пишется что-либо или нет решает сервер: скрипт сначала запрашивает `/u/api/websites/:id/recorder` и без включённой записи просто молчит.

Включение и настройки - в панели, Websites → нужный сайт → Recording:

- **sample rate** - доля сессий под запись; на 100% растёт и трафик, и размер БД аналитики.
- **mask level** - маскирование текста и полей ввода. Записи проходят через прокси приложения, а в приложении есть админка (`/manager`), поэтому маскирование ниже `moderate` ставить не стоит.
- **block selector** - CSS-селектор узлов, которые в запись не попадают. Форму входа админа (`src/components/admin-login.tsx`) имеет смысл занести сюда.

Проверка: `200` на `/u/recorder.js` и на `/u/api/websites/<id>/recorder`. Если в консоли `404` на какой-то другой путь `/u/api/...` - Umami обновилась и завела новый эндпоинт: добавить его в `rewrites` в `next.config.mjs`.

## События

Просмотры страниц Umami считает сам, включая клиентские переходы App Router. Поверх этого шлём точечные события через `trackEvent` из `src/lib/analytics.ts` (без трекера вызов - пустышка):

| Событие | Где | Данные |
| --- | --- | --- |
| `divisions-tab` | переключение дивизиона | `division` |
| `divisions-sort` | сортировка на мобильных пилюлях | `key` |
| `player-profile` | открытие профиля игрока | `rid`, `name` |
| `profile-filter` | сезон/дивизион в профиле | `season`, `division` |
| `profile-tab` | вкладки профиля на мобильных | `tab` |
| `stage-import` | этап загружен | `season`, `division`, `stage` |
| `stage-import-failed` | загрузка сорвалась | `season`, `division`, `stage` |
| `stage-delete` | этап откачен | `season`, `division`, `stage` |

Имена событий - это значения в дашборде, менять их задним числом = разрыв истории.

## Что не собирается

Umami не ставит куки и не хранит IP: посетитель считается по хешу (IP + user-agent + соль), соль ротируется. Персональных данных в событиях нет, кроме публичного имени игрока и его RankedIn ID в `player-profile` - это те же данные, что видны на самой странице.
