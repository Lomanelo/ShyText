/** Keep in sync with services/moderation.ts (client). */

const BLOCKED = [
  /\b(kill\s+yourself|kys)\b/i,
  /\b(nigger|faggot|retard)\b/i,
  /\b(child\s*porn|csam)\b/i,
  /\b(send\s+nudes?)\b/i,
];

export function moderateText(
  text: string,
  options?: { allowEmpty?: boolean; maxLength?: number }
): { ok: true } | { ok: false; reason: string } {
  const value = (text ?? '').trim();
  const max = options?.maxLength ?? 160;
  if (!value) {
    return options?.allowEmpty ? { ok: true } : { ok: false, reason: 'empty' };
  }
  if (value.length > max) {
    return { ok: false, reason: 'too_long' };
  }
  if (BLOCKED.some((pattern) => pattern.test(value))) {
    return { ok: false, reason: 'blocked' };
  }
  return { ok: true };
}
