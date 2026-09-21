import { auth } from './firebase';
import i18n from '../i18n';

/** Netlify API host for notify / report / places (EAS sets EXPO_PUBLIC_API_BASE). */
export function apiBase() {
  const raw = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'https://shytextapi.netlify.app';
}

export async function currentIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

/** For Image / GET proxy URLs that cannot send Authorization (expo-image). */
export async function idTokenQueryValue(): Promise<string | null> {
  return currentIdToken();
}

export async function authedGet(pathOrUrl: string, query?: Record<string, string>) {
  const user = auth.currentUser;
  if (!user) throw new Error(i18n.t('errors.signInFirst'));
  const idToken = await user.getIdToken();
  const url = pathOrUrl.startsWith('http')
    ? new URL(pathOrUrl)
    : new URL(`${apiBase()}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return res;
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
