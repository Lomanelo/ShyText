import type { Config, Context } from '@netlify/functions';

const FIREBASE_API_KEY = 'AIzaSyAVnkBhxkzWdh2fLXsBMRDcRGYbY2KnBeE';
const DATABASE_URL = 'https://myshytext-default-rtdb.firebaseio.com';

type AuthedUser = { uid: string; email?: string };

async function verifyIdToken(request: Request): Promise<AuthedUser | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );
  if (!response.ok) return null;
  const data = await response.json();
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

async function handleNotify(user: AuthedUser, payload: any) {
  const recipientId = payload.recipientId;
  if (!recipientId || recipientId === user.uid) {
    return json({ error: 'Invalid recipient' }, 400);
  }

  const secret = Netlify.env.get('FIREBASE_DATABASE_SECRET');
  if (!secret) {
    return json({ ok: true, skipped: 'missing_database_secret' });
  }

  const tokenRes = await fetch(
    `${DATABASE_URL}/pushTokens/${recipientId}.json?auth=${secret}`
  );
  const tokenData = await tokenRes.json();
  const expoPushToken = tokenData?.expoPushToken;
  if (!expoPushToken) {
    return json({ ok: true, skipped: 'no_token' });
  }

  const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      title: payload.title || 'ShyText',
      body: payload.body || 'New message',
      sound: 'default',
      data: { type: 'chat', chatId: payload.chatId, senderId: user.uid },
    }),
  });
  return json({ ok: pushRes.ok });
}

async function handleReport(user: AuthedUser, payload: any) {
  const secret = Netlify.env.get('FIREBASE_DATABASE_SECRET');
  const inbox = Netlify.env.get('REPORT_INBOX') || 'shytext.info@gmail.com';
  const report = {
    reporterId: user.uid,
    targetType: payload.targetType,
    targetId: payload.targetId,
    reason: payload.reason,
    details: payload.details || '',
    venueId: payload.venueId || null,
    conversationId: payload.conversationId || null,
    createdAt: Date.now(),
    notifyInbox: inbox,
  };

  if (secret) {
    await fetch(`${DATABASE_URL}/reports.json?auth=${secret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  }

  return json({ ok: true });
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
  const payload = await req.json().catch(() => ({}));

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
