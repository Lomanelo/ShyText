import { useCallback, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { PRECISE_ACCURACY_METERS } from '../utils/geo';

export type UserCoords = { latitude: number; longitude: number };

const FIX_WAIT_MS = 8_000;
const FRESH_MS = 20_000;

function asCoords(position: Location.LocationObject): UserCoords {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

async function getPrecisePosition(): Promise<Location.LocationObject> {
  const first = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });
  if ((first.coords.accuracy ?? 999) <= PRECISE_ACCURACY_METERS) {
    return first;
  }

  return new Promise((resolve) => {
    let best = first;
    let settled = false;
    const finish = (value: Location.LocationObject) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const watch = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 1,
        timeInterval: 400,
      },
      (position) => {
        const nextAcc = position.coords.accuracy ?? 999;
        const bestAcc = best.coords.accuracy ?? 999;
        if (nextAcc <= bestAcc) best = position;
        if (nextAcc <= PRECISE_ACCURACY_METERS) {
          void watch.then((sub) => sub.remove());
          finish(best);
        }
      }
    );

    setTimeout(() => {
      void watch.then((sub) => sub.remove());
      finish(best);
    }, FIX_WAIT_MS);
  });
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

  const refresh = useCallback(async (force = false) => {
    const freshPrecise =
      !force &&
      coordsRef.current &&
      Date.now() - atRef.current < FRESH_MS &&
      (accuracyRef.current ?? 999) <= PRECISE_ACCURACY_METERS;
    if (freshPrecise) return coordsRef.current;

    setBusy(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setStatus(permission.status);
      if (permission.status !== 'granted') {
        setError('Location is needed to verify which venue you\'re at.');
        return null;
      }
      const position = await getPrecisePosition();
      const nextAcc = position.coords.accuracy ?? null;
      setAccuracy(nextAcc);
      accuracyRef.current = nextAcc;
      const next = asCoords(position);
      coordsRef.current = next;
      atRef.current = Date.now();
      setCoords(next);
      return next;
    } catch {
      setError('Location unavailable right now.');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { coords, status, error, busy, accuracy, refresh };
}
