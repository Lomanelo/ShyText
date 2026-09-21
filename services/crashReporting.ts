import { Platform } from 'react-native';

type CrashlyticsLike = {
  log: (msg: string) => void;
  recordError: (error: Error) => void;
  setUserId: (uid: string) => void;
  setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
};

function crashlytics(): CrashlyticsLike | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-firebase/crashlytics').default() as CrashlyticsLike;
  } catch {
    return null;
  }
}

export async function startCrashReporting() {
  const c = crashlytics();
  if (!c) return;
  try {
    await c.setCrashlyticsCollectionEnabled(!__DEV__);
  } catch {
    // Native module not linked until next native build.
  }
}

export function setCrashUser(uid: string | null | undefined) {
  const c = crashlytics();
  if (!c || !uid) return;
  try {
    c.setUserId(uid);
  } catch {
    // ignore
  }
}

export function logCrashBreadcrumb(message: string) {
  const c = crashlytics();
  if (!c) return;
  try {
    c.log(message);
  } catch {
    // ignore
  }
}

export function recordCrashError(error: unknown, context?: string) {
  const c = crashlytics();
  if (!c) return;
  try {
    if (context) c.log(context);
    const err = error instanceof Error ? error : new Error(String(error));
    c.recordError(err);
  } catch {
    // ignore
  }
}
