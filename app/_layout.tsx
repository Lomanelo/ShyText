import React, { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { getCurrentUser } from '../src/lib/firebase';
import * as Notifications from 'expo-notifications';
import { defineNotificationChannels, setupNotificationListeners } from '../src/lib/notifications';
import { startScanning, stopScanning } from '../src/hooks/useNearbyUsers';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  // Reference to notification listener cleanup function
  const notificationListeners = useRef<{ unsubscribe: () => void } | null>(null);
  
  // State for BLE scanning
  const [isScanning, setIsScanning] = useState(false);
  const [scanningError, setScanningError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);

  // Initialize notifications
  useEffect(() => {
    // Set up notification channels (primarily for Android)
    const setupNotifications = async () => {
      try {
        await defineNotificationChannels();
        console.log('Notification channels defined');
        
        // Setup notification listeners for handling app in different states
        notificationListeners.current = setupNotificationListeners();
        console.log('Notification listeners set up');
      } catch (error) {
        console.warn('Error setting up notifications:', error);
      }
    };
    
    setupNotifications();
    
    return () => {
      // Clean up notification listeners when component unmounts
      if (notificationListeners.current) {
        notificationListeners.current.unsubscribe();
      }
    };
  }, []);

  // Handle BLE scanning based on app state
  useEffect(() => {
    // Start scanning when app starts
    const currentUser = getCurrentUser();
    if (currentUser) {
      startScanning(setIsLoading, setScanningError, setIsScanning, setNearbyUsers);
      console.log('BLE scanning started from root layout');
    }
    
    // Handle app state changes to manage BLE scanning
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      
      if (nextAppState === 'active') {
        // App came to foreground
        console.log('App is now active, starting BLE scanning');
        startScanning(setIsLoading, setScanningError, setIsScanning, setNearbyUsers);
      } else if (nextAppState === 'background') {
        // App went to background
        console.log('App is now in background, stopping BLE scanning');
        stopScanning(setIsScanning, setIsLoading);
      }
    };
    
    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      // Clean up the subscription and stop scanning when the component unmounts
      subscription.remove();
      stopScanning(setIsScanning, setIsLoading);
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