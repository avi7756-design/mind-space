import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import Badge from './Badge';
import type { Supplier } from '../../types';

export function trustTone(score: number): 'emerald' | 'amber' | 'rose' {
  if (score >= 80) return 'emerald';
  if (score >= 60) return 'amber';
  return 'rose';
}

export default function TrustBadge({ supplier }: { supplier: Supplier }) {
  const tone = trustTone(supplier.trustScore);
  const Icon =
    supplier.verification === 'verified'
      ? ShieldCheck
      : supplier.verification === 'pending'
        ? ShieldQuestion
        : ShieldAlert;
  return (
    <Badge tone={tone}>
      <Icon className="h-3.5 w-3.5" />
      אמינות {supplier.trustScore}
    </Badge>
  );
}
