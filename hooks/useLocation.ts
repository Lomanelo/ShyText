import { useCallback, useRef, useState } from 'react';
import * as Location from 'expo-location';

export type UserCoords = { latitude: number; longitude: number };

const GPS_BUDGET_MS = 2_200;
const FRESH_MS = 25_000;

function asCoords(position: Location.LocationObject): UserCoords {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('gps-timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function getQuickPosition(): Promise<Location.LocationObject> {
  const last = await Location.getLastKnownPositionAsync();
  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      GPS_BUDGET_MS
    );
  } catch {
    if (last) return last;
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  }
}

export function useLocation() {
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [status, setStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const coordsRef = useRef<UserCoords | null>(null);
  const atRef = useRef(0);

  const refresh = useCallback(async (force = false) => {
    if (!force && coordsRef.current && Date.now() - atRef.current < FRESH_MS) {
      return coordsRef.current;
    }
    setBusy(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setStatus(permission.status);
      if (permission.status !== 'granted') {
        setError('Location is needed to verify which venue you\'re at.');
        return null;
      }
      const position = await getQuickPosition();
      setAccuracy(position.coords.accuracy ?? null);
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
