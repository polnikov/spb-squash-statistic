import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @param {string} phase */
const makeConfig = (phase) => ({
  reactStrictMode: true,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  experimental: {
    // BullMQ / ioredis / postgres / drizzle are server-only; keep them out of the
    // client bundle and resolved as externals (route handlers fail to load the
    // drizzle vendor-chunk otherwise).
    serverComponentsExternalPackages: ["bullmq", "ioredis", "postgres", "drizzle-orm"],
  },
  // Рейтинг живёт на корне `/`; отдельного роута /rating нет, так что прямой
  // заход по нему без редиректа даёт 404.
  async redirects() {
    return [{ source: "/rating", destination: "/", permanent: true }];
  },
  // Umami отдаётся со своего же домена под /u. Иначе трекер не заработает:
  // CSP в deploy/caddy.bbrsquashspb.conf разрешает только 'self' для script-src
  // и connect-src, да и блокировщики режут сторонние домены аналитики.
  //
  // Адрес берётся на этапе СБОРКИ: Next пишет destination в routes-manifest.json,
  // и `next start` уже читает манифест, а не конфиг. Прод поэтому живёт на
  // дефолте `http://umami:3000` (имя сервиса в docker-compose), а переменная
  // нужна только когда гоняешь `next dev` против инстанса на другом адресе.
  async rewrites() {
    const umami = (process.env.UMAMI_INTERNAL_URL ?? "http://umami:3000").replace(/\/+$/, "");
    return [
      { source: "/u/script.js", destination: `${umami}/script.js` },
      { source: "/u/api/send", destination: `${umami}/api/send` },
      // Запись сессий. `recorder.js` перед стартом читает настройки записи
      // (включена ли, sample rate, маскирование) с /api/websites/:id/recorder,
      // так что одного скрипта мало: без этого роута он молча ничего не пишет.
      { source: "/u/recorder.js", destination: `${umami}/recorder.js` },
      {
        source: "/u/api/websites/:websiteId/recorder",
        destination: `${umami}/api/websites/:websiteId/recorder`,
      },
    ];
  },
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.specstory/**",
          "**/.claude/**",
          "**/.playwright-mcp/**",
          "**/.impeccable/**",
          "**/mockups/**",
          "**/BBR design/**",
          "**/node_modules/**",
          "**/.next/**",
          "**/.next-dev/**",
        ],
      };
    }

    return config;
  },
});

export default makeConfig;
