import { useEffect, useState } from 'react';
import { CheckIn } from '../types/venue';
import { listenCheckIns } from '../services/venues';

export function useCheckIns(venueId?: string) {
  const [people, setPeople] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    const unsub = listenCheckIns(venueId, (next) => {
      setPeople(next);
      setLoading(false);
    });
    return unsub;
  }, [venueId]);

  return {
    people: people.filter((item) => item.expiresAt > now),
    loading,
  };
}
