export type PlayerAvatarMedia = {
  dataUrl: string;
  fileName: string;
  scale: number;
  x: number;
  y: number;
};

export const PLAYER_AVATAR_STORAGE_KEY = "bbr.playerAvatars.v1";
export const PLAYER_AVATAR_EVENT = "bbr-player-avatars-change";

export function readPlayerAvatars(): Record<string, PlayerAvatarMedia> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PLAYER_AVATAR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PlayerAvatarMedia>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePlayerAvatars(avatars: Record<string, PlayerAvatarMedia>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYER_AVATAR_STORAGE_KEY, JSON.stringify(avatars));
  window.dispatchEvent(new Event(PLAYER_AVATAR_EVENT));
}

export function avatarBackgroundStyle(avatar: PlayerAvatarMedia): CSSProperties {
  return {
    backgroundImage: `url("${avatar.dataUrl}")`,
    backgroundPosition: `${50 + avatar.x}% ${50 + avatar.y}%`,
    backgroundSize: `${avatar.scale}%`,
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
import type { CSSProperties } from "react";
