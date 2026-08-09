import {
  Coins,
  Compass,
  HeartPulse,
  PartyPopper,
  Sprout,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { DomainId } from "@/lib/types";

/**
 * Icons live apart from `domains.ts` so that file stays pure data and can be
 * imported by the PDF generator and any server code without pulling React in.
 */
export const DOMAIN_ICONS: Record<DomainId, LucideIcon> = {
  health: HeartPulse,
  wealth: Coins,
  connections: Users,
  purpose: Compass,
  growth: Sprout,
  peace: Waves,
  fun: PartyPopper,
};

export function DomainIcon({
  domain,
  className,
  strokeWidth = 1.75,
}: {
  domain: DomainId;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = DOMAIN_ICONS[domain];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
