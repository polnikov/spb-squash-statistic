"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Global app render failed", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <html lang="ru">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <main className="flex min-h-dvh items-center justify-center px-4">
          <div className="w-full max-w-[520px] rounded-2xl border border-outline-variant bg-card p-5 text-center shadow-e2">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Приложение временно недоступно</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Сервер вернул ошибку при сборке страницы. Повторите запрос или проверьте server logs.
            </p>
            {error.digest ? (
              <div className="mt-3 rounded-[12px] bg-surface-container-high px-3 py-2 font-mono text-[12px] tabular text-on-surface-variant">
                digest: {error.digest}
              </div>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-[12px] bg-primary px-4 text-[13px] font-semibold text-on-primary"
            >
              <RotateCcw className="size-4" />
              Повторить
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
