import React, { useEffect, useRef, useState, createContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus, Platform, Image } from 'react-native';
import { getCurrentUser } from '../src/lib/firebase';
import * as Notifications from 'expo-notifications';
import { defineNotificationChannels, setupNotificationListeners } from '../src/lib/notifications';
import { startScanning, stopScanning } from '../src/hooks/useNearbyUsers';
import { useAuth } from '../src/hooks/useAuth';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

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
  const [notificationsInitialized, setNotificationsInitialized] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);

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

  // Hide splash screen once app is ready
  useEffect(() => {
    async function prepare() {
      try {
        // Artificial delay to show the splash screen for a bit longer
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Any app initialization logic can go here
      } catch (e) {
        console.warn('Error preparing app:', e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // Preload user profile image when it changes
  useEffect(() => {
    if (user?.photoURL) {
      refreshProfileImage();
    }
  }, [user?.photoURL]);

  // Initialize notifications - only once and early to ensure they work
  useEffect(() => {
    if (notificationsInitialized) return;
    
    // Set up notification channels and listeners early, regardless of login state
    const setupNotificationsEarly = async () => {
      try {
        console.log('Setting up notifications for platform:', Platform.OS);
        await defineNotificationChannels();
        console.log('Notification channels defined');
        
        // Setup notification listeners for handling app in different states
        notificationListeners.current = setupNotificationListeners();
        console.log('Notification listeners set up');
        
        setNotificationsInitialized(true);
      } catch (error) {
        console.warn('Error setting up early notifications:', error);
      }
    };
    
    setupNotificationsEarly();
    
    return () => {
      // Clean up notification listeners when component unmounts
      if (notificationListeners.current) {
        notificationListeners.current.unsubscribe();
      }
    };
  }, []);
  
  // Register for push notifications when user logs in
  useEffect(() => {
    // Only register for push notifications if user is logged in
    if (user) {
      const registerUserForPushNotifications = async () => {
        try {
          console.log('User is logged in, registering for push notifications:', user.uid);
          const { registerForPushNotifications, requestIOSPermissions } = require('../src/lib/notifications');
          
          // For iOS, explicitly request permissions first
          if (Platform.OS === 'ios') {
            const permissionGranted = await requestIOSPermissions();
            console.log('iOS notification permissions granted:', permissionGranted);
          }
          
          const token = await registerForPushNotifications();
          
          if (token) {
            console.log('Successfully registered for push notifications with token:', token.substring(0, 15) + '...');
          } else {
            console.warn('Failed to get push token, will retry later');
            
            // Retry after a delay if it failed
            setTimeout(async () => {
              try {
                // For iOS, explicitly request permissions again before retry
                if (Platform.OS === 'ios') {
                  await requestIOSPermissions();
                }
                
                const retryToken = await registerForPushNotifications();
                console.log('Retry push notification registration result:', retryToken ? 'Success' : 'Failed again');
              } catch (retryError) {
                console.error('Error in retry registration:', retryError);
              }
            }, 5000);
          }
        } catch (error) {
          console.warn('Error registering for push notifications:', error);
        }
      };
      
      registerUserForPushNotifications();
    }
  }, [user?.uid]); // Only re-run when user ID changes (login/logout)

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