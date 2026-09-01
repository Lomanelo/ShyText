import { MAX_MESSAGE_LENGTH } from '../utils/config';
import i18n from '../i18n';

const BLOCKED = [
  /\b(kill\s+yourself|kys)\b/i,
  /\b(nigger|faggot|retard)\b/i,
  /\b(child\s*porn|csam)\b/i,
  /\b(send\s+nudes?)\b/i,
];

export function moderateText(text: string, options?: { allowEmpty?: boolean; maxLength?: number }): { ok: boolean; reason?: string } {
  const value = text.trim();
  const max = options?.maxLength ?? MAX_MESSAGE_LENGTH;
  if (!value) {
    return options?.allowEmpty ? { ok: true } : { ok: false, reason: i18n.t('errors.writeFirst') };
  }
  if (value.length > max) {
    return { ok: false, reason: i18n.t('errors.keepUnder', { count: max }) };
  }
  if (BLOCKED.some((pattern) => pattern.test(value))) {
    return { ok: false, reason: i18n.t('errors.textNotAllowed') };
  }
  return { ok: true };
}
