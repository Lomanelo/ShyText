import React, { useEffect, useRef, useState, createContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus, Platform, Image } from 'react-native';
import { getCurrentUser } from '../src/lib/firebase';
import * as Notifications from 'expo-notifications';
import { defineNotificationChannels, setupNotificationListeners } from '../src/lib/notifications';
import { startScanning, stopScanning } from '../src/hooks/useNearbyUsers';
import { useAuth } from '../src/hooks/useAuth';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Create a Profile Image context to help with caching
export const ProfileImageContext = createContext<{
  refreshProfileImage: () => void;
}>({
  refreshProfileImage: () => {},
});

export default function RootLayout() {
  const { user } = useAuth();
  // Reference to notification listener cleanup function
  const notificationListeners = useRef<{ unsubscribe: () => void } | null>(null);
  
  // State for BLE scanning
  const [isScanning, setIsScanning] = useState(false);
  const [scanningError, setScanningError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);

  // Function to refresh and preload profile image
  const refreshProfileImage = () => {
    if (user?.photoURL) {
      console.log('Preloading profile image:', user.photoURL);
      // Preload the image into the cache
      Image.prefetch(user.photoURL)
        .then(() => console.log('Profile image prefetched successfully'))
        .catch(error => console.error('Error prefetching profile image:', error));
    }
  };

  // Preload user profile image when it changes
  useEffect(() => {
    if (user?.photoURL) {
      refreshProfileImage();
    }
  }, [user?.photoURL]);

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
      startScanning();
      console.log('BLE scanning started from root layout');
    }
    
    // Handle app state changes to manage BLE scanning
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      
      if (nextAppState === 'active') {
        // App came to foreground
        console.log('App is now active, starting BLE scanning');
        startScanning();
      } else if (nextAppState === 'background') {
        // App went to background
        console.log('App is now in background, stopping BLE scanning');
        stopScanning();
      }
    };
    
    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      // Clean up the subscription and stop scanning when the component unmounts
      subscription.remove();
      stopScanning();
    };
  }, []);
  
  return (
    <ProfileImageContext.Provider value={{ refreshProfileImage }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ProfileImageContext.Provider>
  );
}