import { auth } from './firebase';
import i18n from '../i18n';

/** Netlify API host for notify / report (EAS sets EXPO_PUBLIC_API_BASE). */
export function apiBase() {
  const raw = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'https://shytextapi.netlify.app';
}

export async function authedPost(path: string, body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInFirst'));
  const idToken = await user.getIdToken();
  const res = await fetch(`${apiBase()}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `api_${res.status}`);
  }
  return res.json().catch(() => ({ ok: true }));
}
