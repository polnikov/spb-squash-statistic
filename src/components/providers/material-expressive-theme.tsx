"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

/**
 * MaterialExpressiveTheme — the app's theme class provider.
 *
 * Color roles are defined in globals.css using the Flat 2.0 palette from the
 * BBR design mockup. This provider keeps dark mode as the default class.
 */
export function MaterialExpressiveTheme({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
