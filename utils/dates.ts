import i18n from '../i18n';
import { languageTagOf } from '../i18n/languages';

export function timeAgo(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  try {
    const rtf = new Intl.RelativeTimeFormat(languageTagOf(i18n.language), { numeric: 'auto' });
    if (minutes < 1) return rtf.format(0, 'second');
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-Math.round(hours / 24), 'day');
  } catch {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }
}

export function remainingCompact(expiresAt: number): string {
  const minutes = Math.max(0, Math.round((expiresAt - Date.now()) / 60000));
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

export function timeLeft(expiresAt: number): string {
  const compact = remainingCompact(expiresAt);
  if (compact === '<1m') return i18n.t('time.ending');
  return compact;
}

export function memberSince(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(languageTagOf(i18n.language), {
    month: 'short',
    year: 'numeric',
  });
}
