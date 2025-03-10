import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Send a local notification - useful for testing and for in-app notifications
export const sendLocalNotification = async (title: string, body: string, data?: object) => {
  try {
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
    console.log('Local notification scheduled:', { title, body });
    return true;
  } catch (error) {
    console.error('Error sending local notification:', error);
    return false;
  }
};

// Test notification for chats
export const sendChatNotification = async (senderName: string, message: string, conversationId: string, senderId: string) => {
  try {
    const truncatedMessage = message.length > 40 ? message.substring(0, 37) + '...' : message;
    
    await sendLocalNotification(
      `Message from ${senderName}`,
      truncatedMessage,
      {
        type: 'message',
        conversationId,
        senderId,
        timestamp: new Date().toISOString()
      }
    );
    return true;
  } catch (error) {
    console.error('Error sending chat notification:', error);
    return false;
  }
};

// Test notification for new chat requests
export const sendChatRequestNotification = async (senderName: string, message: string, conversationId: string, senderId: string) => {
  try {
    const truncatedMessage = message.length > 40 ? message.substring(0, 37) + '...' : message;
    
    await sendLocalNotification(
      `${senderName} sent you a message`,
      truncatedMessage,
      {
        type: 'first_message',
        conversationId,
        senderId,
        timestamp: new Date().toISOString()
      }
    );
    return true;
  } catch (error) {
    console.error('Error sending chat request notification:', error);
    return false;
  }
}; 