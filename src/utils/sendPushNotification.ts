import { Platform } from 'react-native';
import { getProfile } from '../lib/firebase';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

type PushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data: any;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string; // For Android
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
  receiverId: string, 
  title: string, 
  body: string, 
  data: any
) => {
  try {
    // Get the receiver's profile to get their push token
    const receiverProfile = await getProfile(receiverId);
    
    // If no push token found, we can't send a notification
    if (!receiverProfile || !receiverProfile.push_token) {
      console.log('No push token found for receiver:', receiverId);
      return false;
    }
    
    console.log(`Sending push notification to ${receiverId} with token: ${receiverProfile.push_token}`);
    
    // Format the message
    const message: PushMessage = {
      to: receiverProfile.push_token,
      title,
      body,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      sound: 'default',
    };
    
    // Add Android channel ID if on Android
    if (Platform.OS === 'android') {
      message.channelId = 'messages';
    }
    
    // Send the push notification via Expo's push API
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    console.log('Push notification sent result:', result);
    
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