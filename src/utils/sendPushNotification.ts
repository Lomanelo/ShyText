import { Platform } from 'react-native';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

type PushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data: any;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string; // For Android
  priority?: string;
  ttl?: number;
  expiration?: number;
  categoryId?: string;
  mutableContent?: boolean;
  contentAvailable?: boolean;
};

/**
 * Send push notification using Expo's Push Service
 * 
 * This function can be called from your app whenever you need to send a push notification
 * to another user (when a message is sent, chat request is accepted, etc.)
 * 
 * Note: This approach doesn't require Cloud Functions, but the sender's device
 * needs to be online to trigger the notification.
 */
export const sendPushNotification = async (
  pushToken: string, 
  title: string, 
  body: string, 
  data: any
) => {
  try {
    // If no push token provided, we can't send a notification
    if (!pushToken) {
      console.log('No push token provided for notification');
      return false;
    }
    
    console.log(`Sending high-priority push notification to token: ${pushToken}`);
    
    // Format the message with high-priority settings
    const message: PushMessage = {
      to: pushToken,
      title,
      body,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        priority: 'high',
        urgent: true,
        contentAvailable: true,
      },
      sound: 'default',
      // Priority fields for faster delivery
      priority: 'high',
      ttl: 60, // seconds
      expiration: 60, // seconds
      // iOS specific fields for faster delivery
      categoryId: 'time_sensitive',
      mutableContent: true,
      contentAvailable: true,
    };
    
    // Add Android channel ID if on Android
    if (Platform.OS === 'android') {
      message.channelId = 'messages';
    }
    
    // Send the push notification via Expo's push API with high priority
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Priority': 'high',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    
    // If there are errors, log them
    if (result.errors && result.errors.length > 0) {
      console.error('Push notification errors:', result.errors);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}; 