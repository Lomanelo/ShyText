import i18n from '../i18n';

const LEAKY =
  /firebase|firestore|cloud\s*firestore|storage\/|auth\/|googleapis|permission-denied|insufficient permissions|rpc|grpc|stack trace|exception|error\s*\(|https?:\/\//i;

type ErrorBits = { code: string; message: string };

function errorBits(error: unknown): ErrorBits {
  if (!error || typeof error !== 'object') {
    return { code: '', message: String(error ?? '') };
  }
  const anyErr = error as { code?: string; message?: string; nativeErrorCode?: string };
  return {
    code: String(anyErr.code || anyErr.nativeErrorCode || ''),
    message: String(anyErr.message || ''),
  };
}

function looksUserSafe(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 140) return false;
  if (LEAKY.test(trimmed)) return false;
  // Firebase often prefixes with "Firebase:" even for generic text.
  if (/^firebase:/i.test(trimmed)) return false;
  return true;
}

/** Transient backend / network failures that usually succeed on a short retry. */
export function isTransientError(error: unknown): boolean {
  const { code, message } = errorBits(error);
  const hay = `${code} ${message}`.toLowerCase();
  return (
    hay.includes('unavailable') ||
    hay.includes('deadline-exceeded') ||
    hay.includes('aborted') ||
    hay.includes('cancelled') ||
    hay.includes('canceled') ||
    hay.includes('resource-exhausted') ||
    hay.includes('network-request-failed') ||
    hay.includes('network error') ||
    hay.includes('timeout') ||
    hay.includes('failed-precondition') ||
    // First write after sign-in can briefly look like a permission miss.
    hay.includes('permission-denied') ||
    hay.includes('insufficient permissions')
  );
}

/**
 * Map any thrown value to short, client-safe copy. Never surfaces Firebase codes,
 * stack traces, or backend jargon.
 */
export function userFacingError(error: unknown, fallback?: string): string {
  const soft = fallback || i18n.t('errors.tryAgain');
  const { code, message: raw } = errorBits(error);
  const hay = `${code} ${raw}`.toLowerCase();

  if (__DEV__) {
    console.warn('[userFacingError]', code || '(no code)', raw || error);
  }

  if (raw === 'cancelled' || hay.includes('cancelled') || hay.includes('canceled')) {
    return i18n.t('authErrors.cancelled');
  }
  if (hay.includes('invalid-phone-number') || hay.includes('missing-phone-number')) {
    return i18n.t('authErrors.invalidPhone');
  }
  if (hay.includes('invalid-verification-code') || hay.includes('invalid-credential')) {
    return i18n.t('authErrors.invalidCode');
  }
  if (
    hay.includes('invalid-verification-id') ||
    hay.includes('session-expired') ||
    hay.includes('code-expired')
  ) {
    return i18n.t('authErrors.expiredCode');
  }
  if (hay.includes('too-many-requests') || hay.includes('quota-exceeded')) {
    return i18n.t('authErrors.tooMany');
  }
  if (hay.includes('operation-not-allowed')) {
    return i18n.t('authErrors.notEnabled');
  }
  if (
    hay.includes('captcha-check-failed') ||
    hay.includes('missing-client-identifier') ||
    hay.includes('invalid-app-credential') ||
    hay.includes('app-not-authorized')
  ) {
    return i18n.t('authErrors.captcha');
  }
  if (hay.includes('network-request-failed') || hay.includes('network error') || hay.includes('offline')) {
    return i18n.t('authErrors.network');
  }
  if (hay.includes('user-disabled')) return i18n.t('authErrors.disabled');
  if (hay.includes('requires-recent-login')) return i18n.t('errors.recentLogin');
  if (hay.includes('storage/') || hay.includes('object-not-found') || hay.includes('unauthorized')) {
    // Prefer photo-specific fallback when caller passed one; else generic upload copy.
    if (fallback && /photo|image|upload/i.test(fallback)) return fallback;
    return i18n.t('errors.photoUpload');
  }
  if (hay.includes('permission') || hay.includes('insufficient')) {
    return i18n.t('errors.profilePermission');
  }
  if (hay.includes('unavailable') || hay.includes('deadline') || hay.includes('aborted')) {
    return i18n.t('errors.tryAgain');
  }

  if (looksUserSafe(raw)) return raw.trim();
  return soft;
}

/** Retry transient failures a couple of times with short backoff. */
export async function withTransientRetry<T>(
  action: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 350
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await action();
    } catch (err) {
      last = err;
      if (!isTransientError(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw last;
}
