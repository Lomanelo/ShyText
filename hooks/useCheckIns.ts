import { useEffect, useState } from 'react';
import { CheckIn } from '../types/venue';
import { listenCheckIns } from '../services/venues';

export function useCheckIns(venueId?: string) {
  const [people, setPeople] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!venueId) {
      setPeople([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Soft load: keep any prior list until the first snapshot (no wipe → no empty flash).
    setLoading(true);
    const unsub = listenCheckIns(venueId, (next) => {
      if (cancelled) return;
      setPeople(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [venueId]);

  return {
    people: people.filter((item) => item.expiresAt > now),
    loading,
  };
}
