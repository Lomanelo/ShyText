import { createPrivateKey, sign } from 'node:crypto';

const TOKEN_URL = 'https://maps-api.apple.com/v1/token';

type CachedToken = { token: string; expiresAt: number };

let cached: CachedToken | null = null;

function normalizePem(value: string) {
  const trimmed = value.replace(/\\n/g, '\n').trim();
  if (trimmed.includes('BEGIN')) return trimmed;
  return `-----BEGIN PRIVATE KEY-----\n${trimmed}\n-----END PRIVATE KEY-----`;
}

function base64url(input: Buffer | string) {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function createMapsJwt(teamId: string, keyId: string, privateKeyPem: string) {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ iss: teamId, iat: now, exp: now + 20 * 60 }));
  const data = `${header}.${payload}`;
  const key = createPrivateKey(normalizePem(privateKeyPem));
  const signature = sign('SHA256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `${data}.${base64url(signature)}`;
}

export function appleMapsConfigured() {
  return Boolean(
    Netlify.env.get('APPLE_MAPS_TEAM_ID') &&
      Netlify.env.get('APPLE_MAPS_KEY_ID') &&
      Netlify.env.get('APPLE_MAPS_PRIVATE_KEY')
  );
}

export async function getAppleMapsAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) {
    return cached.token;
  }

  const teamId = Netlify.env.get('APPLE_MAPS_TEAM_ID');
  const keyId = Netlify.env.get('APPLE_MAPS_KEY_ID');
  const privateKey = Netlify.env.get('APPLE_MAPS_PRIVATE_KEY');
  if (!teamId || !keyId || !privateKey) {
    throw Object.assign(new Error('Apple Maps is not configured.'), { status: 501 });
  }

  const jwt = createMapsJwt(teamId, keyId, privateKey);
  const response = await fetch(TOKEN_URL, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) {
    const status = response.status === 401 ? 401 : 502;
    throw Object.assign(new Error('Apple Maps authentication failed.'), { status });
  }
  const body = (await response.json()) as { accessToken?: string; expiresInSeconds?: number };
  if (!body.accessToken) {
    throw Object.assign(new Error('Apple Maps authentication failed.'), { status: 502 });
  }
  const ttlMs = Math.max(60, body.expiresInSeconds ?? 30 * 60) * 1000;
  cached = { token: body.accessToken, expiresAt: Date.now() + ttlMs };
  return body.accessToken;
}
