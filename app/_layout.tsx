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
          // If we have a user, check profile data and navigate accordingly
          if (user) {
            try {
              // Check if the user has a profile
              const hasProfile = await checkUserProfileExists(user.uid);
              console.log(`User ${user.uid} has profile: ${hasProfile}`);
              
              // Store profile status in AsyncStorage
              await AsyncStorage.setItem('userHasProfile', hasProfile ? 'true' : 'false');
              
              // Set authenticated state
              setIsAuthenticated(true);
              
              // If a user is authenticated, redirect them to the main app
              // Using setTimeout to ensure this happens after the component mounts
              setTimeout(() => {
                if (hasProfile) {
                  console.log("User already authenticated, redirecting to main app");
                  router.replace('/(tabs)');
                } else {
                  console.log("User authenticated but needs profile, redirecting to profile");
                  router.replace('/(auth)/profile');
                }
              }, 100);
            } catch (profileError) {
              console.error('Error checking profile:', profileError);
            }
          } else {
            // No user is signed in
            setIsAuthenticated(false);
            console.log("No user is signed in, staying on auth screen");
          }
          
          setInitialized(true);
          SplashScreen.hideAsync();
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