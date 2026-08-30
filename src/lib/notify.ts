import { API_PATHS } from '../constants';
import { auth } from './firebase';

function apiBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_BASE || 'https://shytext.com';
}

async function postApi(path: string, body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) return;
  const idToken = await user.getIdToken();
  try {
    await fetch(`${apiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn('API call failed', path, error);
  }
}

export async function notifyNewMessage(params: {
  recipientId: string;
  title: string;
  body: string;
  chatId: string;
}) {
  await postApi(API_PATHS.notify, params);
}

export async function submitReport(params: {
  targetType: 'note' | 'message' | 'profile';
  targetId: string;
  reason: string;
  details?: string;
  venueId?: string;
  conversationId?: string;
}) {
  await postApi(API_PATHS.report, {
    ...params,
    createdAt: new Date().toISOString(),
  });
}
