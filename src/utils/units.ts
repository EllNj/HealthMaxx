import type { DisplayUnit } from '@/src/features/workouts/types';

const LBS_PER_KG = 2.20462;

export function kgToDisplay(kg: number | null | undefined, unit: DisplayUnit): number | null {
  if (kg == null) return null;
  if (unit === 'lbs') return Math.round(kg * LBS_PER_KG * 100) / 100;
  return Math.round(kg * 100) / 100;
}

export function displayToKg(value: number, unit: DisplayUnit): number {
  if (unit === 'lbs') return Math.round((value / LBS_PER_KG) * 1000) / 1000;
  return Math.round(value * 1000) / 1000;
}

export function formatWeight(kg: number | null | undefined, unit: DisplayUnit): string {
  const v = kgToDisplay(kg, unit);
  if (v == null) return '—';
  const formatted = v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
  return `${formatted} ${unit}`;
}
