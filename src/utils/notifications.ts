import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Configure notification handler according to Expo docs
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Set notification presentation options for iOS
if (Platform.OS === 'ios') {
  Notifications.setNotificationCategoryAsync('default', [
    {
      identifier: 'default',
      buttonTitle: 'View',
      options: {
        isDestructive: false,
        isAuthenticationRequired: false,
      },
    },
  ]);
}

// Register for push notifications
export async function registerForPushNotificationsAsync() {
  try {
    let token;

    // For Android, set up notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    // Get the project ID from the app config
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.log('Project ID not found in app config');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    })).data;
    
    // Save the token to AsyncStorage for later use
    if (token) {
      await AsyncStorage.setItem('pushToken', token);
      console.log('Push token saved:', token);
    }
    
    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return;
  }
}

// Schedule a local notification
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
    console.log('Notification scheduled with ID:', id);
    return id;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
}

// Send a push notification
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data: Record<string, any> = {}) {
  try {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      _displayInForeground: true,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('Push notification result:', result);
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

// Get all scheduled notifications
export async function getAllScheduledNotifications() {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

// Cancel a specific notification
export async function cancelNotification(notificationId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
    throw error;
  }
}

// Cancel all notifications
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
    throw error;
  }
}

// Add notification received listener
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

// Add notification response received listener
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// Get notification permissions
export async function getNotificationPermissions() {
  try {
    return await Notifications.getPermissionsAsync();
  } catch (error) {
    console.error('Error getting notification permissions:', error);
    return { status: 'undetermined' };
  }
}

// Request notification permissions
export async function requestNotificationPermissions() {
  try {
    return await Notifications.requestPermissionsAsync();
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    throw error;
  }
}

// Get notification badge count
export async function getBadgeCount() {
  return await Notifications.getBadgeCountAsync();
}

// Set notification badge count
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

// Dismiss all notifications
export async function dismissAllNotifications() {
  await Notifications.dismissAllNotificationsAsync();
} 