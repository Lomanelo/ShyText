import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ensureUserProfile, getUserProfile } from '../services/auth';
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
          // Restore a wiped Firestore profile from Auth when possible.
          const loaded = (await ensureUserProfile().catch(() => null)) ?? (await getUserProfile(next.uid));
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

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const loaded =
        (await ensureUserProfile().catch(() => null)) ?? (await getUserProfile(auth.currentUser.uid));
      setProfile(loaded);
    } catch {
      // Keep the in-memory profile if Firestore is briefly unreachable.
    }
  }, []);

  return {
    user,
    profile,
    loading,
    hasProfile: !!(profile?.displayName || user?.displayName),
    refreshProfile,
  };
}
