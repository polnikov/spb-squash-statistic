import type { Metadata, Viewport } from "next";
import { MaterialExpressiveTheme } from "@/components/providers/material-expressive-theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPB Squash Statistic",
  description: "Статистика сквош-лиги: рейтинги, дивизионы, этапы, Iron Man.",
  appleWebApp: {
    capable: true,
    title: "SPB Squash",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#161616",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <MaterialExpressiveTheme>{children}</MaterialExpressiveTheme>
      </body>
    </html>
  );
}
