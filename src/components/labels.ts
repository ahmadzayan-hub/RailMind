import type { Assessment } from '@/domain/types';

export const ACTION_LABEL: Record<Assessment['recommendation']['action'], string> = {
  inspect: 'Inspect',
  schedule_pm: 'Schedule preventive maintenance',
  replace_component: 'Replace component',
  monitor: 'Monitor',
};

export function hoursLabel(hours: number): string {
  if (hours < 48) return `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}
