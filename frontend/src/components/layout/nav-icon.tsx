import { BookOpen, Calculator, FileText, House, MapIcon, type LucideIcon } from "lucide-react";

import type { NavIconName } from "@/lib/navigation";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  explore: MapIcon,
  diagnose: Calculator,
  contract: FileText,
  guide: BookOpen,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
