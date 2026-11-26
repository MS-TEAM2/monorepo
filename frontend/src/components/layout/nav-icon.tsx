import { BookOpen, Calculator, Database, FileText, Landmark, MapIcon, type LucideIcon } from "lucide-react";

import type { NavIconName } from "@/lib/navigation";

const ICONS: Record<NavIconName, LucideIcon> = {
  explore: MapIcon,
  diagnose: Calculator,
  contract: FileText,
  guide: BookOpen,
  policy: Landmark,
  data: Database,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
