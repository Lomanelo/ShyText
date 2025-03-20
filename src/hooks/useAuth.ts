import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

type AuthState = {
  user: User | null;
  loading: boolean;
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const auth = getAuth();
    
    // Set initial user if already authenticated
    if (auth.currentUser) {
      setAuthState({
        user: auth.currentUser,
        loading: false,
      });
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed, user:', user?.displayName || 'none');
      setAuthState({
        user,
        loading: false,
      });
    });

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  return authState;
} 