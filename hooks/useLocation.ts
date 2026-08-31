import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export function useLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [status, setStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setStatus(permission.status);
      if (permission.status !== 'granted') {
        setError('Location is needed to verify which venue you\'re at.');
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setAccuracy(position.coords.accuracy ?? null);
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
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
