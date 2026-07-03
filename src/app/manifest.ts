import type { MetadataRoute } from "next";

// Web app manifest — lets Android/iOS install the app standalone (no browser UI)
// instead of a plain tab shortcut. Served at /manifest.webmanifest and linked
// automatically by Next.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SPB Squash Statistic",
    short_name: "SPB Squash",
    description: "Статистика сквош-лиги: рейтинги, дивизионы, этапы, Iron Man.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#5b5b5b",
    theme_color: "#161616",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
