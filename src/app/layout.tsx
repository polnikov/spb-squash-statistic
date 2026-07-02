import type { Metadata } from "next";
import { MaterialExpressiveTheme } from "@/components/providers/material-expressive-theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "ББР Сквош — статистика",
  description: "Статистика сквош-лиги: рейтинги, дивизионы, этапы, Iron Man.",
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
