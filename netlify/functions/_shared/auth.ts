export type AuthedUser = { uid: string; email?: string };

function firebaseWebApiKey() {
  return (
    Netlify.env.get('FIREBASE_WEB_API_KEY') ||
    Netlify.env.get('EXPO_PUBLIC_FIREBASE_API_KEY') ||
    ''
  );
}

/** Verify a Firebase ID token from Authorization: Bearer or ?idToken=. */
export async function verifyIdToken(request: Request): Promise<AuthedUser | null> {
  const header = request.headers.get('authorization') || '';
  let token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    try {
      token = new URL(request.url).searchParams.get('idToken')?.trim() || '';
    } catch {
      token = '';
    }
  }
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

export function json(body: unknown, status = 200, extra?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...extra },
  });
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  if (first) return first;
  return request.headers.get('x-nf-client-connection-ip') || request.headers.get('client-ip') || 'unknown';
}
