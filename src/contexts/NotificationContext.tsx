import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, scheduleLocalNotification, addNotificationResponseReceivedListener, addNotificationReceivedListener } from '../utils/notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { auth, database } from '../lib/firebase';
import { ref, update } from 'firebase/database';

// Define context types
type NotificationContextType = {
  expoPushToken: string | undefined;
  notification: Notifications.Notification | null;
  sendTestNotification: () => Promise<void>;
  lastNotificationResponse: Notifications.NotificationResponse | null;
};

// Create context with default values
const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: undefined,
  notification: null,
  sendTestNotification: async () => {},
  lastNotificationResponse: null,
});

// Provider component
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [lastNotificationResponse, setLastNotificationResponse] = useState<Notifications.NotificationResponse | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        console.log('Push token registered:', token);
        
        // Save token to user's profile in Firebase
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userProfileRef = ref(database, `profiles/${currentUser.uid}`);
          update(userProfileRef, { expoPushToken: token })
            .then(() => console.log('Push token saved to user profile'))
            .catch(err => console.error('Error saving push token to profile:', err));
        }
      }
    });

    // Listen for incoming notifications while the app is foregrounded
    notificationListener.current = addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      setNotification(notification);
    });

    // Listen for user interactions with notifications
    responseListener.current = addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      setLastNotificationResponse(response);
      
      // Handle notification response (e.g., navigate to a specific screen)
      const data = response.notification.request.content.data;
      
      if (data?.type === 'chat' && data?.chatId) {
        // Navigate to chat screen
        router.push(`/chat/${data.chatId}`);
      } else if (data?.type === 'profile') {
        // Navigate to profile screen
        router.push('/(auth)/profile');
      }
    });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Function to send a test notification
  const sendTestNotification = async () => {
    try {
      await scheduleLocalNotification(
        'Test Notification',
        'This is a test notification from ShyText',
        { type: 'test', timestamp: new Date().toISOString() }
      );
      console.log('Test notification sent successfully');
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        sendTestNotification,
        lastNotificationResponse,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotifications = () => useContext(NotificationContext); 