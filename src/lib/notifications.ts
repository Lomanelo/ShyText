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
  handleNotification: async (notification) => {
    // Fast path for high-priority messages - skip complex processing
    const data = notification.request.content.data || {};
    
    // Check if notification is marked as high priority
    if (data.priority === 'high' || data.urgent === true) {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    }
    
    // Check if user is in same conversation (only for non-urgent messages)
    if ((data?.type === 'message' || data?.type === 'new_message') && 
        data.conversationId && isViewingConversation(data.conversationId)) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    
    // Default fast path
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

// Track which conversation the user is currently viewing
let currentViewingConversationId: string | null = null;

export const setViewingConversation = (conversationId: string | null) => {
  currentViewingConversationId = conversationId;
  console.log('Now viewing conversation:', conversationId);
};

export const isViewingConversation = (conversationId: string): boolean => {
  return currentViewingConversationId === conversationId;
};

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
  
  console.log('Requesting iOS notification permissions');
  
  try {
    // Get current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('Current iOS notification permission status:', existingStatus);
    
    let finalStatus = existingStatus;
    
    // Only ask if permissions have not been determined or not granted
    if (existingStatus !== 'granted') {
      console.log('Requesting full iOS notification permissions...');
      
      // Request permission with full authorization (not provisional)
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: false,
          allowCriticalAlerts: true, // Request critical alerts permission
          provideAppNotificationSettings: true,
          allowProvisional: false, // Not using provisional notifications
        },
      });
      
      finalStatus = status;
      console.log('iOS notification permission request result:', finalStatus);
    }
    
    // To ensure background notifications, we need to explicitly call registerForPushNotificationsAsync
    // This is different from just getting permission
    if (finalStatus === 'granted') {
      console.log('iOS push notifications authorized, completing setup');
    } else {
      console.warn('iOS push notifications not fully authorized:', finalStatus);
    }
    
    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error during iOS notification permission request:', error);
    return false;
  }
};

// Register for push notifications - call this after login or signup
export const registerForPushNotifications = async () => {
  if (!Device.isDevice) {
    console.log('Physical device is required for Push Notifications - running in simulator');
    return null;
  }
  
  try {
    // Define channels for Android
    await defineNotificationChannels();
    
    // Request iOS permissions
    if (Platform.OS === 'ios') {
      try {
        const permissionGranted = await requestIOSPermissions();
        if (!permissionGranted) {
          console.log('Notification permissions not granted on iOS');
          // Still continue - some notification features might work without full permissions
        }
      } catch (iosError) {
        console.error('Error requesting iOS permissions:', iosError);
        // Continue despite errors to try getting a token anyway
      }
    }
    
    // Get the token using the EAS project ID
    console.log('Getting push token with project ID:', EXPO_PROJECT_ID);
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID
      });
      
      const token = tokenResponse.data;
      console.log('Push token received:', token);
      
      // Store the token in Firebase for the current user
      if (auth.currentUser) {
        console.log('Saving push token to Firebase for user:', auth.currentUser.uid);
        try {
          await updatePushToken(auth.currentUser.uid, token);
          console.log('Push token saved to Firebase');
        } catch (updateError) {
          console.error('Error saving push token to Firebase:', updateError);
          // Continue despite the error - at least we got the token
        }
      } else {
        console.warn('No current user to save push token');
      }
      
      return token;
    } catch (tokenError) {
      console.error('Error getting push token:', tokenError);
      
      // On iOS, try one more time with a different method if the first one fails
      if (Platform.OS === 'ios') {
        try {
          console.log('Trying alternative method to get push token');
          const legacyToken = await Notifications.getExpoPushTokenAsync();
          console.log('Got legacy push token:', legacyToken.data);
          
          if (auth.currentUser) {
            await updatePushToken(auth.currentUser.uid, legacyToken.data);
          }
          
          return legacyToken.data;
        } catch (legacyError) {
          console.error('Error getting legacy push token:', legacyError);
          return null;
        }
      }
      
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

  // Check if user is authenticated
  if (!auth.currentUser) {
    console.log('User not authenticated when handling notification - storing for later processing');
    // Store the notification data for later processing after authentication
    storeNotificationForLaterProcessing(data);
    // Redirect to login if user is not authenticated
    router.replace('/');
    return;
  }

  // Handle different notification types
  switch (data.type) {
    case 'first_message':
    case 'message':
    case 'new_message':
      // Open the chat screen for all message-related notifications
      router.push(`/chat/${data.conversationId}`);
      break;
    
    case 'chat_accepted':
      // Open the chat screen when a chat request is accepted
      router.push(`/chat/${data.conversationId}`);
      break;
    
    case 'verification':
      // Open the settings page when user gets verified
      router.push('/settings');
      break;
      
    default:
      console.log('Unhandled notification type:', data.type);
  }
};

// Store notification for processing after authentication
let pendingNotification: any = null;
export const storeNotificationForLaterProcessing = (data: any) => {
  pendingNotification = data;
};

// Check if there's a pending notification to process
export const processPendingNotification = () => {
  if (pendingNotification && auth.currentUser) {
    console.log('Processing pending notification after authentication');
    const notificationToProcess = pendingNotification;
    pendingNotification = null;
    handleNotificationInteraction(notificationToProcess);
    return true;
  }
  return false;
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

// Send a local notification that can wake up the app from the background
export const sendBackgroundLocalNotification = async (title: string, body: string, data?: object) => {
  try {
    console.log('Sending high-priority background notification');
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          ...data,
          // These properties help with faster background delivery
          contentAvailable: true,
          priority: 'high',
          urgent: true,
          messageId: Date.now().toString(),
          // Add iOS-specific flags
          '_displayInForeground': true,
          'mutable-content': 1,
          'interruption-level': 'time-sensitive',
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'critical_message', // Use our critical message category
        autoDismiss: false, // Don't auto dismiss on iOS
      },
      trigger: null, // Trigger immediately
    });
    console.log('High-priority background notification sent');
  } catch (error) {
    console.error('Error sending background notification:', error);
  }
};

// Enable background notification handling for iOS
if (Platform.OS === 'ios') {
  // Set up time-sensitive category for faster delivery
  Notifications.setNotificationCategoryAsync('time_sensitive', [
    {
      identifier: 'read',
      buttonTitle: 'Open',
      options: {
        opensAppToForeground: true,
      }
    }
  ]).catch(error => {
    console.error('Failed to set up time-sensitive category:', error);
  });
  
  // Regular message category
  Notifications.setNotificationCategoryAsync('message', [
    {
      identifier: 'read',
      buttonTitle: 'Read',
      options: {
        opensAppToForeground: true,
      }
    }
  ]).catch(error => {
    console.error('Failed to set notification category:', error);
  });
  
  // Critical notifications category
  Notifications.setNotificationCategoryAsync('critical_message', [
    {
      identifier: 'read',
      buttonTitle: 'Read',
      options: {
        opensAppToForeground: true,
      }
    }
  ]).catch(error => {
    console.error('Failed to set critical notification category:', error);
  });
} 