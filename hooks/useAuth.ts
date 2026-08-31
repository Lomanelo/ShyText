import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/auth';
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
          setProfile(await getUserProfile(next.uid));
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return {
    user,
    profile,
    loading,
    hasProfile: !!profile?.displayName,
    refreshProfile: async () => {
      if (auth.currentUser) {
        setProfile(await getUserProfile(auth.currentUser.uid));
      }
    },
  };
}
