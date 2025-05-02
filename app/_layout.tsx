import React, { useEffect, useState } from 'react';
import { SplashScreen, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, checkUserProfileExists } from '../src/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '../src/styles/theme';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for authentication state on app start
    const initAuth = async () => {
      try {
        // Listen for auth state changes from Firebase
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          try {
            // Clear any stale data first
            await AsyncStorage.multiRemove([
              'userProfile',
              'userHasProfile',
              'lastKnownLocation',
              'userPreferences'
            ]);

            // If we have a user, check profile data
          if (user) {
              // Check if the user has a profile
              const hasProfile = await checkUserProfileExists(user.uid);
              console.log(`User ${user.uid} has profile: ${hasProfile}`);
              
              // Store profile status in AsyncStorage
              await AsyncStorage.setItem('userHasProfile', hasProfile ? 'true' : 'false');
              
              // Set authenticated state
              setIsAuthenticated(true);
                } else {
              setIsAuthenticated(false);
              console.log("No user is signed in");
            }
          } catch (error) {
            console.error('Error during auth check:', error);
            setIsAuthenticated(false);
          } finally {
            // Always set initialized to true after auth check
            setInitialized(true);
            SplashScreen.hideAsync();
          }
        });
        
        return unsubscribe;
      } catch (e) {
        console.error('Auth initialization error:', e);
        setInitialized(true);
        SplashScreen.hideAsync();
      }
    };

    initAuth();
  }, []);

  // Separate effect for navigation based on auth state
  useEffect(() => {
    if (!initialized) return;

    const navigateBasedOnAuth = async () => {
      try {
        const user = auth.currentUser;
        if (user && isAuthenticated) {
          const hasProfile = await checkUserProfileExists(user.uid);
          if (hasProfile) {
            console.log("User authenticated with profile, navigating to main app");
            router.replace('/(tabs)');
          } else {
            console.log("User authenticated without profile, navigating to profile");
            router.replace('/(auth)/profile');
          }
        } else {
          console.log("No authenticated user, navigating to auth");
          router.replace('/(auth)');
        }
      } catch (error) {
        console.error('Navigation error:', error);
        router.replace('/(auth)');
      }
    };

    navigateBasedOnAuth();
  }, [initialized, isAuthenticated]);

  if (!initialized) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}