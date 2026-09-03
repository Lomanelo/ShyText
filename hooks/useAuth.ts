import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/auth';
import { prefetchProfileImage } from '../services/imageCache';
import { UserProfile } from '../types/user';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      try {
        if (next) {
          await next.getIdToken();
          const loaded = await getUserProfile(next.uid);
          setProfile(loaded);
          prefetchProfileImage([next.uid, loaded?.avatarUrl], loaded?.avatarUrl);
        } else {
          setProfile(null);
        }
      } catch {
        // A failed profile read is not "no profile" — don't dump the user into setup.
        if (!next) setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return {
    user,
    profile,
    loading,
    hasProfile: !!(profile?.displayName || user?.displayName),
    refreshProfile: async () => {
      if (!auth.currentUser) return;
      try {
        setProfile(await getUserProfile(auth.currentUser.uid));
      } catch {
        // Keep the in-memory profile if Firestore is briefly unreachable.
      }
    },
  };
}
