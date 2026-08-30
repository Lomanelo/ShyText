const BLOCKED_PATTERNS: RegExp[] = [
  /\b(kill\s+yourself|kys)\b/i,
  /\b(nigger|nigga|faggot|retard)\b/i,
  /\b(rape|rapist)\b/i,
  /\b(child\s*porn|csam|onlyfans)\b/i,
  /\b(send\s+nudes?|nude\s+pics?)\b/i,
  /\b(hook\s*up\s+tonight|looking\s+for\s+sex)\b/i,
  /\b(whats?app|telegram)\s*[:.]?\s*\+?\d/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
];

export type ModerationResult = {
  ok: boolean;
  reason?: string;
};

export function moderateText(raw: string): ModerationResult {
  const text = (raw || '').trim();
  if (!text) {
    return { ok: false, reason: 'Write something first.' };
  }
  if (text.length > 2000) {
    return { ok: false, reason: 'That message is too long.' };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        ok: false,
        reason: 'That text breaks our community guidelines. Please rephrase.',
      };
    }
  }
  return { ok: true };
}

export function assertModerated(raw: string): string {
  const result = moderateText(raw);
  if (!result.ok) {
    throw new Error(result.reason || 'Message blocked.');
  }
  return raw.trim();
}
