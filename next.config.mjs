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
