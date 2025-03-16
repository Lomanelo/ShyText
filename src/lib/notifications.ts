import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getProfile, auth, updatePushToken } from './firebase';
import { router } from 'expo-router';
import Constants from 'expo-constants';

// Use this project ID from the EAS configuration
const EXPO_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId || '8eb807c3-b6cb-4ac8-8d94-63de6e0fda1a';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Define notification channel for Android
export const defineNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00ADAD',
    });
    
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      description: 'Notifications for new messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00ADAD',
    });
  }
};

// Request permissions specifically for iOS
export const requestIOSPermissions = async () => {
  if (Platform.OS !== 'ios') return true;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  // Only ask if permissions have not been determined
  if (existingStatus !== 'granted') {
    // Request permission
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts: false,
        provideAppNotificationSettings: true,
        allowProvisional: true,
      },
    });
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
};

// Register for push notifications - call this after login or signup
export const registerForPushNotifications = async () => {
  if (!Device.isDevice) {
    console.log('Physical device is required for Push Notifications');
    return null;
  }
  
  try {
    // Define channels for Android
    await defineNotificationChannels();
    
    // Request iOS permissions
    if (Platform.OS === 'ios') {
      const permissionGranted = await requestIOSPermissions();
      if (!permissionGranted) {
        console.log('Notification permissions not granted on iOS');
        return null;
      }
    }
    
    // Get the token using the EAS project ID
    console.log('Getting push token with project ID:', EXPO_PROJECT_ID);
    try {
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID
      })).data;
      
      console.log('Push token received:', token);
      
      // Store the token in Firebase for the current user
      if (auth.currentUser) {
        await updatePushToken(auth.currentUser.uid, token);
        console.log('Push token saved to Firebase');
      } else {
        console.warn('No current user to save push token');
      }
      
      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  } catch (error) {
    console.error('Error in registerForPushNotifications:', error);
    return null;
  }
};

// Listen for notification interactions
export const setupNotificationListeners = () => {
  // Handle notifications that are received while the app is foregrounded
  const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received in foreground!', notification);
  });

  // Handle interactions when the app is in the foreground
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    const { notification } = response;
    const data = notification.request.content.data;
    
    handleNotificationInteraction(data);
  });

  return {
    unsubscribe: () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    }
  };
};

// Handle what happens when a user taps on a notification
export const handleNotificationInteraction = (data: any) => {
  if (!data) return;

  console.log('Handling notification interaction:', data);

  // Both first messages and regular messages now open the chat screen directly
  if (data.type === 'first_message' || data.type === 'message') {
    router.push(`/chat/${data.conversationId}`);
  }
};

// Send a local notification - useful for testing
export const sendLocalNotification = async (title: string, body: string, data?: object) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
  });
}; 