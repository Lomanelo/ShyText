import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus, Platform } from 'react-native';
import LocationService from '../src/services/LocationService';
import { getCurrentUser } from '../src/lib/firebase';

export default function RootLayout() {
  // Initialize background location service and handle app state changes
  useEffect(() => {
    // Initialize the service
    LocationService.initialize().then(() => {
      console.log('Location service initialized in root layout');
      
      // Start background tracking if user is logged in
      const currentUser = getCurrentUser();
      if (currentUser) {
        LocationService.startBackgroundTracking().then(success => {
          if (success) {
            console.log('Background location tracking started from root layout');
          } else {
            console.warn('Failed to start background location tracking from root layout');
          }
        });
      }
    });
    
    // Handle app state changes to ensure background tracking continues
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      
      if (nextAppState === 'active') {
        // App came to foreground
        console.log('App is now active, checking location services');
        LocationService.startBackgroundTracking().catch(console.error);
      } else if (nextAppState === 'background') {
        // App went to background
        console.log('App is now in background, ensuring location tracking continues');
        // For Android, make sure the service keeps running
        if (Platform.OS === 'android') {
          LocationService.startBackgroundTracking().catch(console.error);
        }
      }
    };
    
    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      // Clean up the subscription when the component unmounts
      subscription.remove();
      // Note: We intentionally do NOT stop the location service when the app unmounts
    };
  }, []);
  
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}