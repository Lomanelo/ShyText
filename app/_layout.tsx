import React, { useEffect, useState } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getCachedAuthState } from '../src/lib/firebase';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Check for authentication state on app start
    const initAuth = async () => {
      try {
        // First check the cached state for faster startup
        const cachedUser = await getCachedAuthState();
        
        // Then listen for auth state changes from Firebase
        const unsubscribe = onAuthStateChanged(auth, () => {
          setInitialized(true);
          SplashScreen.hideAsync();
        });
        
        // If we have cached user data, we can hide the splash screen early
        if (cachedUser) {
          setInitialized(true);
          SplashScreen.hideAsync();
        }
        
        return unsubscribe;
      } catch (e) {
        console.error('Auth initialization error:', e);
        setInitialized(true);
        SplashScreen.hideAsync();
      }
    };

    initAuth();
  }, []);

  if (!initialized) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: {
          backgroundColor: '#1a1a1a',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: '#1a1a1a',
        },
      }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}