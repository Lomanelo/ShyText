import { MAX_MESSAGE_LENGTH } from '../utils/config';

const BLOCKED = [
  /\b(kill\s+yourself|kys)\b/i,
  /\b(nigger|faggot|retard)\b/i,
  /\b(child\s*porn|csam)\b/i,
  /\b(send\s+nudes?)\b/i,
];

export function moderateText(text: string): { ok: boolean; reason?: string } {
  const value = text.trim();
  if (!value) return { ok: false, reason: 'Write something first.' };
  if (value.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `Keep it under ${MAX_MESSAGE_LENGTH} characters.` };
  }
  if (BLOCKED.some((pattern) => pattern.test(value))) {
    return { ok: false, reason: 'That text is not allowed.' };
  }
  return { ok: true };
}
