import { useEffect, useState } from 'react';
import { ShyTextPost } from '../types/shytext';
import { listenShyTexts } from '../services/shytexts';

export function useShyTexts(venueId?: string) {
  const [posts, setPosts] = useState<ShyTextPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!venueId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = listenShyTexts(venueId, (next) => {
      setPosts(next);
      setLoading(false);
    });
    return unsub;
  }, [venueId]);

  return {
    posts: posts.filter((item) => item.expiresAt > now && item.status === 'active'),
    loading,
  };
}
