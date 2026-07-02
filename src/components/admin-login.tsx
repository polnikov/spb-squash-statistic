"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { LockKeyhole } from "lucide-react";
import { loginAction, type LoginState } from "@/app/(app)/manager/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-[12px] bg-primary px-5 text-[13px] font-semibold text-on-primary shadow-e2 disabled:opacity-60"
    >
      {pending ? "Вход…" : "Войти"}
    </button>
  );
}

export function AdminLogin() {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {});
  return (
    <div className="hidden min-h-[calc(100dvh-80px)] items-center justify-center md:flex">
      <form action={formAction} className="flex w-full max-w-[430px] flex-col gap-5 rounded-2xl bg-card p-7 shadow-e3">
        <div className="flex items-center gap-4">
          <div className="flex size-[54px] items-center justify-center rounded-2xl bg-surface-container-high shadow-e1">
            <LockKeyhole className="size-6 text-on-surface-variant" />
          </div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight">Администрирование</h1>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-on-surface-variant">Логин</span>
          <input
            name="username"
            autoComplete="username"
            placeholder="admin"
            className="h-11 w-full rounded-[12px] border border-outline-variant bg-surface-container-low px-3.5 text-[13px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/55 focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-on-surface-variant">Пароль</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 w-full rounded-[12px] border border-outline-variant bg-surface-container-low px-3.5 text-[13px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/55 focus:border-primary"
          />
        </label>
        {state.error ? (
          <div className="rounded-[12px] bg-error-container px-3.5 py-2.5 text-xs font-medium text-on-error-container shadow-e1">
            {state.error}
          </div>
        ) : null}
        <SubmitButton />
      </form>
    </div>
  );
}
