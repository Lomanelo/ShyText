import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { processPendingNotification } from '../lib/notifications';

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
    // Set initial user if already authenticated
    if (auth.currentUser) {
      setAuthState({
        user: auth.currentUser,
        loading: false,
      });
      // Process any pending notifications
      processPendingNotification();
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed, user:', user?.email || 'none');
      setAuthState({
        user,
        loading: false,
      });
      
      // If user just authenticated, process any pending notifications
      if (user) {
        setTimeout(() => {
          // Use a small delay to ensure Firebase auth is fully initialized
          processPendingNotification();
        }, 500);
      }
    });

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  return authState;
} 