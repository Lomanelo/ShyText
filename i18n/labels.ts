import i18n from './index';
import { ICEBREAKERS, ShyTextVibe } from '../types/shytext';

export function vibeLabel(vibe: ShyTextVibe): string {
  return i18n.t(`vibes.${vibe}`);
}

export function icebreakersFor(vibe: ShyTextVibe): string[] {
  const list = i18n.t(`icebreakers.${vibe}`, { returnObjects: true });
  return Array.isArray(list) ? (list as string[]) : ICEBREAKERS[vibe];
}

/**
 * Stable, language-independent id for a suggested icebreaker: "vibe.index".
 * Stored alongside the raw text so the receiver sees it in their own language.
 */
export function icebreakerKeyFor(vibe: ShyTextVibe, index: number): string {
  return `${vibe}.${index}`;
}

/** Resolve a stored icebreaker key in the viewer's language. Undefined when unknown. */
export function icebreakerFromKey(key?: string | null): string | undefined {
  if (!key) return undefined;
  // Dynamic key — bypass i18next's literal key union; result is validated below.
  const translate = i18n.t as unknown as (k: string) => unknown;
  const value = translate(`icebreakers.${key}`);
  return typeof value === 'string' && value.length > 0 && !value.startsWith('icebreakers.')
    ? value
    : undefined;
}
