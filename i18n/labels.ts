import i18n from './index';
import { ICEBREAKERS, ShyTextVibe } from '../types/shytext';

export function vibeLabel(vibe: ShyTextVibe): string {
  return i18n.t(`vibes.${vibe}`);
}

export function icebreakersFor(vibe: ShyTextVibe): string[] {
  const list = i18n.t(`icebreakers.${vibe}`, { returnObjects: true });
  return Array.isArray(list) ? (list as string[]) : ICEBREAKERS[vibe];
}
