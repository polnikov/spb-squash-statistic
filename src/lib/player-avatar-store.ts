import type { CSSProperties } from "react";

export type PlayerAvatarMedia = {
  dataUrl: string;
  fileName: string;
  scale: number;
  x: number;
  y: number;
};

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
