import type { CSSProperties } from "react";

/**
 * What a page needs to paint an avatar: a URL served by /api/player-avatar plus
 * the crop the admin set. The bytes never travel in the RSC payload - a page with
 * 80 players would otherwise ship 80 base64 photos inside its HTML.
 */
export type PlayerAvatarMedia = {
  /** Served image URL, versioned so a new upload busts the browser cache. */
  url: string;
  scale: number;
  x: number;
  y: number;
};

/** An avatar being edited. `dataUrl` holds a freshly picked file until it is
 *  saved, and is what gets uploaded. */
export type PlayerAvatarDraft = PlayerAvatarMedia & {
  dataUrl?: string;
  fileName?: string;
};

/** Longest side of a stored avatar. Cards paint it around 220px and the profile
 *  hero around 480px on a 2x screen, so 768px covers every surface. */
export const AVATAR_MAX_SIDE = 768;

/** Server-side ceiling: a 768px WebP lands near 60 KB, so this only catches abuse. */
export const AVATAR_MAX_BYTES = 400_000;

export const AVATAR_MIME_TYPES = ["image/webp", "image/jpeg", "image/png"];

export function avatarBackgroundStyle(avatar: PlayerAvatarDraft): CSSProperties {
  return {
    backgroundImage: `url("${avatar.dataUrl ?? avatar.url}")`,
    backgroundPosition: `${50 + avatar.x}% ${50 + avatar.y}%`,
    backgroundSize: `${avatar.scale}%`,
  };
}

/**
 * Downscale and re-encode a picked photo in the browser.
 *
 * A phone photo runs to several megabytes; sending it raw overran the 1 MB body
 * limit of a Server Action and the upload died in the server render. WebP at
 * 768px lands around 60 KB, which keeps the table small and the image quick to
 * serve.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось обработать изображение");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = canvas.toDataURL("image/webp", 0.82);
  // Safari before 16 has no WebP encoder and hands back a PNG instead.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

/** Split a data URL into its mime type and raw bytes. */
export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
}
