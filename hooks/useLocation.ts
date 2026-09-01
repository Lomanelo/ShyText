import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { distanceBetween } from '../utils/geo';
import i18n from '../i18n';

export type UserCoords = { latitude: number; longitude: number };

/** CoreLocation Balanced is ~100 m — same scale as Nearby. */
const WATCH_ACCURACY = Location.Accuracy.Balanced;
const LAST_KNOWN_MAX_AGE_MS = 90_000;
const LAST_KNOWN_MAX_ACC_M = 150;
const REUSE_MS = 15_000;
const FIRST_FIX_WAIT_MS = 2_000;

type Listener = (position: Location.LocationObject) => void;

const listeners = new Set<Listener>();
let watch: Location.LocationSubscription | null = null;
let watchStart: Promise<void> | null = null;
let latest: Location.LocationObject | null = null;

function asCoords(position: Location.LocationObject): UserCoords {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function accuracyOf(position: Location.LocationObject | null) {
  return position?.coords.accuracy ?? 999;
}

function ensureWatch() {
  if (watch || watchStart) return watchStart;
  watchStart = Location.watchPositionAsync(
    {
      accuracy: WATCH_ACCURACY,
      distanceInterval: 5,
      timeInterval: 1000,
    },
    (position) => {
      latest = position;
      listeners.forEach((listener) => listener(position));
    }
  )
    .then((sub) => {
      watch = sub;
    })
    .catch(() => {
      watchStart = null;
    });
  return watchStart;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  void ensureWatch();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      watch?.remove();
      watch = null;
      watchStart = null;
    }
  };
}

function waitForFix(maxMs: number): Promise<Location.LocationObject | null> {
  if (latest) return Promise.resolve(latest);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(latest);
    }, maxMs);
    const unsubscribe = subscribe((position) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(position);
    });
  });
}

/** One-shot GPS for reopen checkout. Does not start the Nearby watch. */
export async function readForegroundPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
} | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') return null;
  try {
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 8_000);
    });
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeout,
    ]);
    if (!position) return null;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}

export function useLocation() {
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [status, setStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const coordsRef = useRef<UserCoords | null>(null);
  const accuracyRef = useRef<number | null>(null);
  const atRef = useRef(0);

  const apply = useCallback((position: Location.LocationObject) => {
    const next = asCoords(position);
    const prev = coordsRef.current;
    if (prev && distanceBetween(prev.latitude, prev.longitude, next.latitude, next.longitude) < 2) {
      const nextAcc = position.coords.accuracy ?? null;
      if (nextAcc != null) {
        accuracyRef.current = nextAcc;
        setAccuracy(nextAcc);
      }
      return next;
    }
    coordsRef.current = next;
    atRef.current = Date.now();
    accuracyRef.current = position.coords.accuracy ?? null;
    setCoords(next);
    setAccuracy(position.coords.accuracy ?? null);
    return next;
  }, []);

  useEffect(() => subscribe(apply), [apply]);

  const refresh = useCallback(
    async (force = false) => {
      const reusable =
        !force &&
        coordsRef.current &&
        Date.now() - atRef.current < REUSE_MS;
      if (reusable) return coordsRef.current;

      setBusy(true);
      setError(null);
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        setStatus(permission.status);
        if (permission.status !== 'granted') {
          setError(i18n.t('location.needed'));
          return null;
        }

        void ensureWatch();

        let last = await Location.getLastKnownPositionAsync({
          maxAge: LAST_KNOWN_MAX_AGE_MS,
          requiredAccuracy: LAST_KNOWN_MAX_ACC_M,
        });
        last =
          last ??
          (await Location.getLastKnownPositionAsync({
            maxAge: LAST_KNOWN_MAX_AGE_MS * 2,
          }));
        if (last && (!latest || accuracyOf(last) <= accuracyOf(latest))) {
          latest = last;
        }
        if (latest && !force) {
          return apply(latest);
        }

        const next = (await waitForFix(FIRST_FIX_WAIT_MS)) ?? last ?? latest;
        if (!next) {
          setError(i18n.t('location.unavailable'));
          return null;
        }
        return apply(next);
      } catch {
        setError(i18n.t('location.unavailable'));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [apply]
  );

  return { coords, status, error, busy, accuracy, refresh };
}
