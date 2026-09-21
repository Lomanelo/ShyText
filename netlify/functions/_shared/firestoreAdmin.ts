import { createSign } from 'node:crypto';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function readServiceAccount(): ServiceAccount | null {
  const raw = Netlify.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    // Env JSON often stores newlines as \n.
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    return parsed;
  } catch {
    return null;
  }
}

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = b64url(signer.sign(sa.private_key));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`token_exchange_${res.status}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('token_missing');
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

/** Decode Firestore REST field values into plain JS. */
function decodeFields(fields?: Record<string, unknown>): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = decodeValue(value);
  }
  return out;
}

function decodeValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) {
    const map = v.mapValue as { fields?: Record<string, unknown> };
    return decodeFields(map.fields);
  }
  if ('arrayValue' in v) {
    const arr = v.arrayValue as { values?: unknown[] };
    return (arr.values ?? []).map(decodeValue);
  }
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}

export async function getFirestoreDoc(path: string): Promise<Record<string, unknown> | null> {
  const sa = readServiceAccount();
  if (!sa) return null;
  const token = await getAccessToken(sa);
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore_get_${res.status}`);
  const data = (await res.json()) as { fields?: Record<string, unknown> };
  return decodeFields(data.fields);
}

function encodeValue(value: string | number | boolean): Record<string, unknown> {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  return { doubleValue: value };
}

type QueryFilter = {
  field: string;
  op: 'EQUAL' | 'IN';
  value: string | number | boolean;
};

/** Run a small structured query (equality filters). Returns decoded docs. */
export async function queryCollection(
  collectionId: string,
  filters: QueryFilter[],
  limit = 5
): Promise<Array<Record<string, unknown> & { __id?: string }>> {
  const sa = readServiceAccount();
  if (!sa) return [];
  const token = await getAccessToken(sa);
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents:runQuery`;
  const fieldFilters = filters.map((f) => ({
    fieldFilter: {
      field: { fieldPath: f.field },
      op: f.op,
      value: encodeValue(f.value as string | number | boolean),
    },
  }));
  const where =
    fieldFilters.length === 1
      ? fieldFilters[0]
      : { compositeFilter: { op: 'AND', filters: fieldFilters } };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where,
        limit,
      },
    }),
  });
  if (!res.ok) throw new Error(`firestore_query_${res.status}`);
  const rows = (await res.json()) as Array<{
    document?: { name?: string; fields?: Record<string, unknown> };
  }>;
  return rows
    .filter((row) => row.document?.fields)
    .map((row) => {
      const name = row.document?.name || '';
      const id = name.split('/').pop();
      return { __id: id, ...decodeFields(row.document?.fields) };
    });
}

function encodeFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value === null) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      fields[key] = Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map((item) => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') {
              return Number.isInteger(item)
                ? { integerValue: String(item) }
                : { doubleValue: item };
            }
            return { nullValue: null };
          }),
        },
      };
    }
  }
  return fields;
}

export async function createFirestoreDoc(
  path: string,
  data: Record<string, unknown>
): Promise<void> {
  const sa = readServiceAccount();
  if (!sa) throw new Error('missing_service_account');
  const token = await getAccessToken(sa);
  const parts = path.split('/');
  const docId = parts.pop();
  const parent = parts.join('/');
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${parent}?documentId=${encodeURIComponent(docId || '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`firestore_create_${res.status}`);
}

/** Create a doc with an auto-generated id under a collection path. */
export async function addFirestoreDoc(
  collectionPath: string,
  data: Record<string, unknown>
): Promise<string> {
  const sa = readServiceAccount();
  if (!sa) throw new Error('missing_service_account');
  const token = await getAccessToken(sa);
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${collectionPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`firestore_add_${res.status}`);
  const body = (await res.json()) as { name?: string };
  const id = body.name?.split('/').pop();
  if (!id) throw new Error('firestore_add_missing_id');
  return id;
}

export async function patchFirestoreDoc(
  path: string,
  data: Record<string, unknown>
): Promise<void> {
  const sa = readServiceAccount();
  if (!sa) throw new Error('missing_service_account');
  const token = await getAccessToken(sa);
  const fieldPaths = Object.keys(data).filter((k) => data[k] !== undefined);
  const qs = fieldPaths.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}?${qs}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`firestore_patch_${res.status}`);
}

export function firestoreAdminConfigured() {
  return Boolean(readServiceAccount());
}
