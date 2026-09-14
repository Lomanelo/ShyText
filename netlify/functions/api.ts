import type { Config, Context } from '@netlify/functions';
import { firestoreAdminConfigured, getFirestoreDoc } from './_shared/firestoreAdmin';

type AuthedUser = { uid: string; email?: string };

function firebaseWebApiKey() {
  return (
    Netlify.env.get('FIREBASE_WEB_API_KEY') ||
    Netlify.env.get('EXPO_PUBLIC_FIREBASE_API_KEY') ||
    ''
  );
}

async function verifyIdToken(request: Request): Promise<AuthedUser | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const apiKey = firebaseWebApiKey();
  if (!apiKey) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { users?: Array<{ localId?: string; email?: string }> };
  const user = data.users?.[0];
  if (!user?.localId) return null;
  return { uid: user.localId, email: user.email };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleNotify(user: AuthedUser, payload: Record<string, unknown>) {
  const recipientId = typeof payload.recipientId === 'string' ? payload.recipientId : '';
  if (!recipientId || recipientId === user.uid) {
    return json({ error: 'Invalid recipient' }, 400);
  }
  if (!firestoreAdminConfigured()) {
    return json({ ok: true, skipped: 'missing_service_account' });
  }

  const device = await getFirestoreDoc(`users/${recipientId}/private/device`);
  const expoPushToken =
    typeof device?.expoPushToken === 'string' ? device.expoPushToken : undefined;
  if (!expoPushToken) {
    // Legacy public-field fallback while clients migrate.
    const profile = await getFirestoreDoc(`users/${recipientId}`);
    const legacy = typeof profile?.expoPushToken === 'string' ? profile.expoPushToken : undefined;
    if (!legacy) return json({ ok: true, skipped: 'no_token' });
    return sendExpo(legacy, payload);
  }
  return sendExpo(expoPushToken, payload);
}

async function sendExpo(expoPushToken: string, payload: Record<string, unknown>) {
  const title = typeof payload.title === 'string' ? payload.title : 'ShyText';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const channelId = typeof payload.channelId === 'string' ? payload.channelId : 'default';
  const data =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? (payload.data as Record<string, string>)
      : {};

  const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      title,
      body,
      sound: 'default',
      channelId,
      data,
    }),
  });
  return json({ ok: pushRes.ok });
}

async function handleReport(user: AuthedUser, payload: Record<string, unknown>) {
  const inbox = Netlify.env.get('REPORT_INBOX') || 'hello@shytext.com';
  const report = {
    reporterId: user.uid,
    targetType: payload.targetType ?? null,
    targetId: payload.targetId ?? null,
    reason: payload.reason ?? null,
    details: payload.details ?? '',
    venueId: payload.venueId ?? null,
    conversationId: payload.conversationId ?? null,
    createdAt: Date.now(),
  };

  const resendKey = Netlify.env.get('RESEND_API_KEY');
  if (resendKey) {
    const from = Netlify.env.get('REPORT_FROM') || 'ShyText Reports <onboarding@resend.dev>';
    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [inbox],
        subject: `ShyText report: ${String(report.reason || 'other')}`,
        text: [
          `Reporter: ${report.reporterId}`,
          `Target: ${report.targetType} / ${report.targetId}`,
          `Reason: ${report.reason}`,
          `Details: ${report.details || '(none)'}`,
          `Venue: ${report.venueId || '(none)'}`,
          `Conversation: ${report.conversationId || '(none)'}`,
          `At: ${new Date(report.createdAt).toISOString()}`,
        ].join('\n'),
      }),
    });
    if (!mail.ok) {
      const errText = await mail.text().catch(() => '');
      return json({ ok: false, emailed: false, error: errText || `mail_${mail.status}` }, 502);
    }
    return json({ ok: true, emailed: true });
  }

  // No mail provider configured — still acknowledge; Firestore is the system of record.
  return json({ ok: true, emailed: false, skipped: 'missing_resend_api_key', inbox });
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const user = await verifyIdToken(req);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (url.pathname.endsWith('/notify')) {
    return handleNotify(user, payload);
  }
  if (url.pathname.endsWith('/report')) {
    return handleReport(user, payload);
  }
  return json({ error: 'Not found' }, 404);
};

export const config: Config = {
  path: ['/api/notify', '/api/report'],
};
