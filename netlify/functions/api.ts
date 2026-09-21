import type { Config, Context } from '@netlify/functions';
import { clientIp, json, verifyIdToken, type AuthedUser } from './_shared/auth';
import {
  addFirestoreDoc,
  firestoreAdminConfigured,
  getFirestoreDoc,
  patchFirestoreDoc,
} from './_shared/firestoreAdmin';
import { moderateText } from './_shared/moderation';
import { callerMayNotify } from './_shared/notifyAccess';
import { pruneRateLimits, rateLimit } from './_shared/rateLimit';

function resendApiKey() {
  return Netlify.env.get('RESEND_API_KEY') || '';
}

async function handleNotify(user: AuthedUser, payload: Record<string, unknown>, req: Request) {
  pruneRateLimits();
  const ip = clientIp(req);
  const uidLimit = rateLimit(`notify:uid:${user.uid}`, 40, 60_000);
  if (!uidLimit.ok) {
    return json(
      { error: 'Too many requests', code: 'rate_limited' },
      429,
      { 'Retry-After': String(uidLimit.retryAfterSec) }
    );
  }
  const ipLimit = rateLimit(`notify:ip:${ip}`, 80, 60_000);
  if (!ipLimit.ok) {
    return json(
      { error: 'Too many requests', code: 'rate_limited' },
      429,
      { 'Retry-After': String(ipLimit.retryAfterSec) }
    );
  }

  const recipientId = typeof payload.recipientId === 'string' ? payload.recipientId : '';
  if (!recipientId || recipientId === user.uid) {
    return json({ error: 'Invalid recipient', code: 'bad_request' }, 400);
  }

  const data =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? Object.fromEntries(
          Object.entries(payload.data as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string')
            .map(([k, v]) => [k, v as string])
        )
      : {};

  if (!firestoreAdminConfigured()) {
    return json({ ok: true, skipped: 'missing_service_account' });
  }

  const allowed = await callerMayNotify(user.uid, recipientId, data);
  if (!allowed) {
    return json({ error: 'Forbidden', code: 'forbidden' }, 403);
  }

  const device = await getFirestoreDoc(`users/${recipientId}/private/device`);
  const expoPushToken =
    typeof device?.expoPushToken === 'string' ? device.expoPushToken : undefined;
  if (!expoPushToken) {
    const profile = await getFirestoreDoc(`users/${recipientId}`);
    const legacy = typeof profile?.expoPushToken === 'string' ? profile.expoPushToken : undefined;
    if (!legacy) return json({ ok: true, skipped: 'no_token' });
    return sendExpo(legacy, payload, data);
  }
  return sendExpo(expoPushToken, payload, data);
}

async function sendExpo(
  expoPushToken: string,
  payload: Record<string, unknown>,
  data: Record<string, string>
) {
  const titleRaw = typeof payload.title === 'string' ? payload.title : 'ShyText';
  const bodyRaw = typeof payload.body === 'string' ? payload.body : '';
  const titleMod = moderateText(titleRaw, { maxLength: 80 });
  const bodyMod = moderateText(bodyRaw, { allowEmpty: true, maxLength: 200 });
  if (!titleMod.ok || !bodyMod.ok) {
    return json({ error: 'Rejected', code: 'moderation' }, 400);
  }
  const channelId = typeof payload.channelId === 'string' ? payload.channelId : 'default';

  const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      title: titleRaw.slice(0, 80),
      body: bodyRaw.slice(0, 200),
      sound: 'default',
      channelId,
      data,
    }),
  });
  return json({ ok: pushRes.ok });
}

async function handleReport(user: AuthedUser, payload: Record<string, unknown>, req: Request) {
  pruneRateLimits();
  const uidLimit = rateLimit(`report:uid:${user.uid}`, 10, 60 * 60_000);
  if (!uidLimit.ok) {
    return json(
      { error: 'Too many requests', code: 'rate_limited' },
      429,
      { 'Retry-After': String(uidLimit.retryAfterSec) }
    );
  }

  const detailsRaw = typeof payload.details === 'string' ? payload.details : '';
  const detailsMod = moderateText(detailsRaw, { allowEmpty: true, maxLength: 500 });
  if (!detailsMod.ok) {
    return json({ error: 'Rejected', code: 'moderation' }, 400);
  }

  const inbox = Netlify.env.get('REPORT_INBOX') || 'hello@shytext.com';
  const report = {
    reporterId: user.uid,
    targetType: payload.targetType ?? null,
    targetId: payload.targetId ?? null,
    reason: payload.reason ?? null,
    details: detailsRaw.slice(0, 500),
    venueId: payload.venueId ?? null,
    conversationId: payload.conversationId ?? null,
    createdAt: Date.now(),
    clientIp: clientIp(req),
  };

  const resendKey = resendApiKey();
  if (!resendKey) {
    return json({ ok: true, emailed: false, skipped: 'missing_resend' });
  }

  const from = Netlify.env.get('REPORT_FROM') || 'ShyText Reports <onboarding@resend.dev>';
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [inbox],
      subject: `[ShyText report] ${String(report.reason || 'other')} · ${String(report.targetType || '?')}`,
      text: JSON.stringify(report, null, 2),
    }),
  });
  return json({ ok: emailRes.ok, emailed: emailRes.ok });
}

async function handleMessage(user: AuthedUser, payload: Record<string, unknown>, req: Request) {
  pruneRateLimits();
  const uidLimit = rateLimit(`messages:uid:${user.uid}`, 60, 60_000);
  if (!uidLimit.ok) {
    return json(
      { error: 'Too many requests', code: 'rate_limited' },
      429,
      { 'Retry-After': String(uidLimit.retryAfterSec) }
    );
  }

  const conversationId =
    typeof payload.conversationId === 'string' ? payload.conversationId.trim() : '';
  const text = typeof payload.text === 'string' ? payload.text : '';
  if (!conversationId) {
    return json({ error: 'Missing conversation', code: 'bad_request' }, 400);
  }
  const moderated = moderateText(text, { maxLength: 160 });
  if (!moderated.ok) {
    return json({ error: 'Rejected', code: moderated.reason }, 400);
  }
  if (!firestoreAdminConfigured()) {
    return json({ error: 'Unavailable', code: 'missing_service_account' }, 503);
  }

  const convo = await getFirestoreDoc(`conversations/${conversationId}`);
  if (!convo) {
    return json({ error: 'Not found', code: 'not_found' }, 404);
  }
  const ids = convo.participantIds;
  if (!Array.isArray(ids) || !ids.includes(user.uid)) {
    return json({ error: 'Forbidden', code: 'forbidden' }, 403);
  }
  if (convo.status !== 'active') {
    return json({ error: 'Chat closed', code: 'closed' }, 403);
  }

  const body = text.trim();
  const now = Date.now();
  await addFirestoreDoc(`conversations/${conversationId}/messages`, {
    senderId: user.uid,
    text: body,
    createdAt: now,
  });
  await patchFirestoreDoc(`conversations/${conversationId}`, {
    lastMessage: body,
    lastMessageAt: now,
    lastSenderId: user.uid,
    status: 'active',
  });
  return json({ ok: true });
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const user = await verifyIdToken(req);
  if (!user) {
    return json({ error: 'Unauthorized', code: 'unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (url.pathname.endsWith('/notify')) {
    return handleNotify(user, payload, req);
  }
  if (url.pathname.endsWith('/report')) {
    return handleReport(user, payload, req);
  }
  if (url.pathname.endsWith('/messages')) {
    return handleMessage(user, payload, req);
  }
  if (url.pathname.endsWith('/moderate')) {
    pruneRateLimits();
    const uidLimit = rateLimit(`moderate:uid:${user.uid}`, 120, 60_000);
    if (!uidLimit.ok) {
      return json(
        { error: 'Too many requests', code: 'rate_limited' },
        429,
        { 'Retry-After': String(uidLimit.retryAfterSec) }
      );
    }
    const text = typeof payload.text === 'string' ? payload.text : '';
    const maxLength = typeof payload.maxLength === 'number' ? payload.maxLength : 160;
    const allowEmpty = payload.allowEmpty === true;
    const result = moderateText(text, { maxLength, allowEmpty });
    if (!result.ok) {
      return json({ ok: false, reason: result.reason }, 400);
    }
    return json({ ok: true });
  }
  return json({ error: 'Not found' }, 404);
};

export const config: Config = {
  path: ['/api/notify', '/api/report', '/api/messages', '/api/moderate'],
};
