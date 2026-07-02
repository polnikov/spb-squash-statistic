"use client";

import * as React from "react";
import {
  avatarBackgroundStyle,
  PLAYER_AVATAR_EVENT,
  PLAYER_AVATAR_STORAGE_KEY,
  readPlayerAvatars,
  type PlayerAvatarMedia,
} from "@/lib/player-avatar-store";
import { cn } from "@/lib/utils";

export function usePlayerAvatar(rid: string | undefined): PlayerAvatarMedia | null {
  const [avatars, setAvatars] = React.useState<Record<string, PlayerAvatarMedia>>({});

  React.useEffect(() => {
    setAvatars(readPlayerAvatars());

    function refresh() {
      setAvatars(readPlayerAvatars());
    }

    function onStorage(event: StorageEvent) {
      if (event.key === PLAYER_AVATAR_STORAGE_KEY) refresh();
    }

    window.addEventListener(PLAYER_AVATAR_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PLAYER_AVATAR_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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
