# Публичный API

Read-only контракт для сторонних приложений. Ключ не нужен: отдаются те же
публичные данные, что и так лежат на сайте.

Базовый адрес прода: `https://bbrsquashspb.ohmyapps.xyz`

## GET /api/public/players/lookup

Проверяет, играет ли человек в лиге, и отдаёт ссылку на его профиль.

### Параметры

| Параметр | Обязательный | Описание |
|---|---|---|
| `rankedinId` | да | RankedIn id игрока, например `R000064106`. До 64 символов. |

### Ответы

Игрок найден - `200`:

```json
{
  "found": true,
  "player": {
    "rankedinId": "R000064106",
    "name": "Константин Балабушко",
    "profileUrl": "https://bbrsquashspb.ohmyapps.xyz/players/R000064106",
    "profilePath": "/players/R000064106"
  }
}
```

Игрок не найден - тоже `200`:

```json
{ "found": false }
```

Промах не отдаётся как 404 намеренно: запрос отработал, ответ - "такого нет".
Сторонней стороне не приходится разбирать коды, хватает поля `found`. 404 от
этого адреса означает только одно: роут не существует (опечатка в пути).

Параметр не передан или длиннее 64 символов - `400`:

```json
{ "error": "rankedinId is required" }
```

### Поля игрока

- `rankedinId` - канонический id. Может отличаться от того, что вы прислали:
  RankedIn выдаёт новый id при удалении и пересоздании профиля, старый остаётся
  алиасом. Ищем по обоим, отвечаем каноническим. Если храните id у себя - имеет
  смысл обновлять его из ответа.
- `name` - отображаемое имя, то же самое, что видно на сайте.
- `profileUrl` - абсолютная ссылка на профиль, готова к вставке.
- `profilePath` - тот же путь без домена, если домен вы клеите сами.

### Формат id

Формат `rankedinId` не валидируется по маске: в базе лежат не только id вида
`R000064106`, но и, например, `D861293_76068`. Непривычный id вернёт
`{"found": false}`, а не ошибку - чтобы смена формата на стороне RankedIn не
роняла интеграцию.

### CORS и кеш

`Access-Control-Allow-Origin: *`, методы `GET, OPTIONS`. Звать можно прямо из
браузера. Ответ кешируется прокси на 5 минут
(`Cache-Control: public, s-maxage=300, stale-while-revalidate=600`), так что
частый опрос одного и того же id до базы не доходит.

### Примеры

```bash
curl "https://bbrsquashspb.ohmyapps.xyz/api/public/players/lookup?rankedinId=R000064106"
```

```js
const res = await fetch(
  `https://bbrsquashspb.ohmyapps.xyz/api/public/players/lookup?rankedinId=${encodeURIComponent(rid)}`,
);
const data = await res.json();
if (data.found) {
  // показать ссылку на профиль
  link.href = data.player.profileUrl;
  link.textContent = data.player.name;
}
```

## Настройка на нашей стороне

`profileUrl` собирается из env `APP_URL` - той же, что уже описана в
`.env.example` и прокидывается в контейнер из `docker-compose.yml`. Если её нет,
адрес берётся из заголовков запроса (`x-forwarded-proto` / `x-forwarded-host`,
их проставляет Caddy), в последнюю очередь из `host`. На `next dev` это даёт
ссылку на localhost, а не на прод.
