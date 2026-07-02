import { Blocks, Bot, Layers, Star, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** match nested routes (e.g. /players/3) as active */
  match?: (pathname: string) => boolean;
};

// Order mirrors the mockup bottom nav (Рейтинг centered).
export const NAV_ITEMS: NavItem[] = [
  { href: "/stages", label: "Этапы", icon: Blocks },
  { href: "/divisions", label: "Дивизионы", icon: Layers },
  { href: "/", label: "Рейтинг", icon: Star, match: (p) => p === "/" },
  { href: "/ironman", label: "Iron Man", icon: Bot },
  { href: "/players", label: "Игроки", icon: Users },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
