import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { sendPushNotification } from './sendPushNotification';

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

// Send notification when someone sends a ShyText (remote push notification)
export const sendNewMessageNotification = async (senderName: string, message: string, conversationId: string, senderId: string, receiverId: string) => {
  try {
    const truncatedMessage = message.length > 40 ? message.substring(0, 37) + '...' : message;
    
    // Try to send a remote push notification first
    const pushResult = await sendPushNotification(
      receiverId,
      `Someone sent you a ShyText`,
      truncatedMessage || "Tap to view the message",
      {
        type: 'new_message',
        conversationId,
        senderId,
        timestamp: new Date().toISOString()
      }
    );
    
    console.log('Remote push notification result:', pushResult);
    
    // If the remote notification fails or we're in a development environment,
    // fall back to a local notification (for testing)
    if (!pushResult) {
      await sendLocalNotification(
        `Someone sent you a ShyText`,
        truncatedMessage || "Tap to view the message",
        {
          type: 'new_message',
          conversationId,
          senderId,
          timestamp: new Date().toISOString()
        }
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error sending new message notification:', error);
    return false;
  }
};

// Send notification when someone accepts your ShyText (remote push notification)
export const sendChatAcceptedNotification = async (receiverName: string, conversationId: string, receiverId: string) => {
  try {
    // Try to send a remote push notification first
    const pushResult = await sendPushNotification(
      receiverId,
      `Someone accepted your ShyText`,
      receiverName ? `${receiverName} accepted your chat request` : "Your chat request was accepted",
      {
        type: 'chat_accepted',
        conversationId,
        timestamp: new Date().toISOString()
      }
    );
    
    console.log('Remote push notification result:', pushResult);
    
    // Fall back to local notification if remote fails
    if (!pushResult) {
      await sendLocalNotification(
        `Someone accepted your ShyText`,
        receiverName ? `${receiverName} accepted your chat request` : "Your chat request was accepted",
        {
          type: 'chat_accepted',
          conversationId,
          timestamp: new Date().toISOString()
        }
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error sending chat accepted notification:', error);
    return false;
  }
};

// Send notification when user gets verified (remote push notification)
export const sendVerificationNotification = async (userId: string) => {
  try {
    // For verification, we're sending a notification to the user themselves,
    // so receiverId is the same as userId
    const pushResult = await sendPushNotification(
      userId,
      `User is Verified`,
      "Your account has been verified successfully!",
      {
        type: 'verification',
        userId,
        timestamp: new Date().toISOString()
      }
    );
    
    console.log('Remote push notification result:', pushResult);
    
    // Fall back to local notification if remote fails
    if (!pushResult) {
      await sendLocalNotification(
        `User is Verified`,
        "Your account has been verified successfully!",
        {
          type: 'verification',
          userId,
          timestamp: new Date().toISOString()
        }
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error sending verification notification:', error);
    return false;
  }
}; 