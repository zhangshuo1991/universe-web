import type { LocationHotspot } from '@/types/explorer';

export function compactMapLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return '';

  const withoutParen = normalized.replace(/\s*\(([^)]+)\)/g, '');
  const segments = withoutParen
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    return `${segments[0]} · ${segments.at(-1)}`;
  }

  return withoutParen.length > 26 ? `${withoutParen.slice(0, 24)}…` : withoutParen;
}

export function getHotspotColor(priority: LocationHotspot['priority']) {
  if (priority === 'critical') return '#f97316';
  if (priority === 'major') return '#f7b955';
  return '#5eead4';
}
