"use client";

import * as React from "react";
import { avatarBackgroundStyle, type PlayerAvatarMedia } from "@/lib/player-avatar-store";
import { cn } from "@/lib/utils";

/**
 * Avatars now live in the DB, fetched by the server component and handed to this
 * provider, so every device sees the same photos. `usePlayerAvatar` reads the map
 * from context; without a provider it returns null (initials fallback).
 */
const AvatarContext = React.createContext<Record<string, PlayerAvatarMedia>>({});

export function PlayerAvatarProvider({
  avatars,
  children,
}: {
  avatars: Record<string, PlayerAvatarMedia>;
  children: React.ReactNode;
}) {
  return <AvatarContext.Provider value={avatars}>{children}</AvatarContext.Provider>;
}

export function usePlayerAvatar(rid: string | undefined): PlayerAvatarMedia | null {
  const avatars = React.useContext(AvatarContext);
  return rid ? avatars[rid] ?? null : null;
}

export function PlayerAvatar({
  rid,
  initials,
  color,
  className,
}: {
  rid?: string;
  initials: string;
  color: string;
  className?: string;
}) {
  const avatar = usePlayerAvatar(rid);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-cover bg-center font-semibold text-white",
        className,
      )}
      style={avatar ? avatarBackgroundStyle(avatar) : { background: color }}
    >
      {avatar ? null : initials}
    </span>
  );
}
