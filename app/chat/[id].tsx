import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDatabase, ref, push, onValue, query, orderByChild, get, set, onDisconnect } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../src/lib/firebase';
import { colors, typography, spacing, shadows, borderRadius } from '../../src/styles/theme';
import { sendPushNotification } from '../../src/utils/notifications';
import ImagePreviewModal from '../components/ImagePreviewModal';

type Message = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
};

type Conversation = {
  initiatorId: string;
  receiverId: string;
  createdAt: string;
  participants: Record<string, boolean>;
  firstSenderId?: string;
  firstSenderMessageCount?: number;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<{
    id: string;
    name: string;
    photoURL?: string | null;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth.currentUser;
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);

  // Add effect to track when user is viewing the chat
  useEffect(() => {
    if (!id || typeof id !== 'string' || !currentUser) return;

    const db = getDatabase();
    const activeChatRef = ref(db, `activeChats/${id}/${currentUser.uid}`);
    
    // Set user as active in this chat
    set(activeChatRef, {
      lastActive: new Date().toISOString(),
      isActive: true
    });

    // Set up cleanup when user leaves the chat
    onDisconnect(activeChatRef).remove();

    return () => {
      // Remove user from active chats when component unmounts
      set(activeChatRef, null);
    };
  }, [id, currentUser]);

  useEffect(() => {
    if (!id || typeof id !== 'string') {
      setError('Invalid conversation ID');
      setLoading(false);
      return;
    }
    
    if (!currentUser) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }
    
    const db = getDatabase();
    
    // Load conversation data
    const conversationPath = 'conversations/' + id;
    const conversationRef = ref(db, conversationPath);
    const unsubscribeConversation = onValue(conversationRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setError('Conversation not found');
        setLoading(false);
        return;
      }
      
      const conversationData = snapshot.val() as Conversation;
      setConversation(conversationData);
      
      // Determine which user is the other participant
      const otherUserId = conversationData.initiatorId === currentUser.uid ? 
                         conversationData.receiverId : 
                         conversationData.initiatorId;
      
      // Get the other user's profile
      const profilePath = 'profiles/' + otherUserId;
      const userProfileRef = ref(db, profilePath);
      const profileSnapshot = await get(userProfileRef);
      
      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.val();
        setOtherUser({
          id: otherUserId,
          name: profileData.firstName || 'User',
          photoURL: profileData.photoURL
        });
      } else {
        // Try fallback to users collection
        const userPath = 'users/' + otherUserId;
        const userRef = ref(db, userPath);
        const userSnapshot = await get(userRef);
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          setOtherUser({
            id: otherUserId,
            name: userData.displayName || 'User',
            photoURL: userData.photoURL
          });
        } else {
          setOtherUser({
            id: otherUserId,
            name: 'User',
            photoURL: null
          });
        }
      }
    });
    
    // Load messages
    const messagesPath = 'messages/' + id;
    const messagesRef = ref(db, messagesPath);
    const messagesQuery = query(messagesRef, orderByChild('createdAt'));
    
    const unsubscribeMessages = onValue(messagesQuery, async (snapshot) => {
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messagesList: Message[] = [];
        const unreadMessages: Record<string, any> = {};
        let hasUnread = false;
        
        // Check if receiver has responded and clear warning if needed
        if (conversation?.firstSenderId === currentUser.uid) {
          const hasReceiverResponded = Object.values(messagesData).some(
            (msg: any) => msg.senderId !== currentUser.uid
          );
          if (hasReceiverResponded) {
            setWarningMessage(null);
          }
        }
        
        // Convert to array and add IDs
        Object.entries(messagesData).forEach(([key, value]) => {
          const message = value as any;
          messagesList.push({
            id: key,
            ...message
          });
          
          // Mark messages as read if they're from the other user
          if (message.senderId !== currentUser.uid && !message.read) {
            hasUnread = true;
            unreadMessages[key] = {
              ...message,
              read: true
            };
          }
        });
        
        // Update unread messages to mark them as read
        if (hasUnread) {
          for (const [key, message] of Object.entries(unreadMessages)) {
            const msgPath = 'messages/' + id + '/' + key;
            const messageRef = ref(db, msgPath);
            await set(messageRef, message);
          }
        }
        
        // Sort by timestamp
        messagesList.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        setMessages(messagesList);
      } else {
        setMessages([]);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribeConversation();
      unsubscribeMessages();
    };
  }, [id]);

  const handleSend = async () => {
    if (!newMessage.trim() || !id || typeof id !== 'string') return;

    try {
      if (!currentUser) throw new Error('You must be logged in');
      
      const db = getDatabase();
      const messagesPath = 'messages/' + id;
      const messagesRef = ref(db, messagesPath);
      
      // Check if this is the first message in the conversation
      const messagesSnapshot = await get(messagesRef);
      const isFirstMessage = !messagesSnapshot.exists();
      
      // Get current conversation data
      const conversationRef = ref(db, 'conversations/' + id);
      const conversationSnapshot = await get(conversationRef);
      const currentConversation = conversationSnapshot.val();
      
      let hasReceiverResponded = false;
      
      // Check if the other user has responded (only if we're the first sender)
      if (currentConversation.firstSenderId === currentUser.uid) {
        hasReceiverResponded = messagesSnapshot.exists() && 
          Object.values(messagesSnapshot.val()).some((msg: any) => 
            msg.senderId !== currentUser.uid
          );
        
        // If receiver has responded, we can reset the message count
        if (hasReceiverResponded) {
          currentConversation.firstSenderMessageCount = 0;
        }
        // Otherwise check the message limit
        else if ((currentConversation.firstSenderMessageCount || 0) >= 2) {
          setWarningMessage('Wait for a response before sending more messages');
          return;
        }
      }
      
      // Clear any existing warning when sending is allowed
      setWarningMessage(null);
      
      const newMessageRef = push(messagesRef);
      const messageData = {
        content: newMessage.trim(),
        senderId: currentUser.uid,
        createdAt: new Date().toISOString()
      };
      
      await set(newMessageRef, messageData);
      
      // Update conversation with first sender info and message count
      const updatedConversation = {
        ...currentConversation,
        lastMessage: newMessage.trim(),
        lastMessageTime: new Date().toISOString()
      };
      
      if (isFirstMessage) {
        updatedConversation.firstSenderId = currentUser.uid;
        updatedConversation.firstSenderMessageCount = 1;
      } else if (currentConversation.firstSenderId === currentUser.uid && !hasReceiverResponded) {
        // Only increment the count if the receiver hasn't responded yet
        updatedConversation.firstSenderMessageCount = (currentConversation.firstSenderMessageCount || 0) + 1;
      }
      
      await set(conversationRef, updatedConversation);
      
      // Send push notification to the receiver only if they're not actively viewing the chat
      if (otherUser && otherUser.id)
        try {
          // Check if receiver is actively viewing the chat
          const activeChatRef = ref(db, `activeChats/${id}/${otherUser.id}`);
          const activeChatSnapshot = await get(activeChatRef);
          const isReceiverActive = activeChatSnapshot.exists() && activeChatSnapshot.val()?.isActive;

          if (!isReceiverActive) {
            // Get the receiver's push token from their profile
            const receiverProfileRef = ref(db, `profiles/${otherUser.id}`);
            const receiverProfileSnapshot = await get(receiverProfileRef);
            
            if (receiverProfileSnapshot.exists()) {
              const receiverProfile = receiverProfileSnapshot.val();
              const receiverPushToken = receiverProfile.expoPushToken;
              
              if (receiverPushToken) {
                // Get the latest sender information
                const senderProfileRef = ref(db, `profiles/${currentUser.uid}`);
                const senderProfileSnapshot = await get(senderProfileRef);
                let senderName = currentUser.displayName || 'Someone';
                
                if (senderProfileSnapshot.exists()) {
                  const senderProfile = senderProfileSnapshot.val();
                  senderName = senderProfile.firstName || senderProfile.displayName || senderName;
                }
                
                // Send push notification with latest sender name
                await sendPushNotification(
                  receiverPushToken,
                  `New message from ${senderName}`,
                  newMessage.trim(),
                  { 
                    type: 'chat',
                    chatId: id,
                    senderId: currentUser.uid,
                    senderName: senderName
                  }
                );
                console.log('Push notification sent to receiver');
              }
            }
          } else {
            console.log('Receiver is actively viewing the chat, notification skipped');
          }
        } catch (notifError) {
          console.error('Error sending push notification:', notifError);
          // Continue anyway - message is saved even if notification fails
        }
      
      setNewMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      
      <View style={styles.chatHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          {otherUser?.photoURL ? (
            <TouchableOpacity onPress={() => setImagePreviewVisible(true)}>
              <Image 
                source={{ uri: otherUser.photoURL }} 
                style={styles.headerAvatar} 
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarText}>
                {otherUser?.name.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={styles.chatHeaderText}>{otherUser?.name || 'Chat'}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      
      {warningMessage && (
        <View style={styles.warningBar}>
          <Text style={styles.warningText}>{warningMessage}</Text>
        </View>
      )}
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.senderId === auth.currentUser?.uid ? 
              styles.sentMessage : 
              styles.receivedMessage
          ]}>
            <Text style={[
              styles.messageText,
              { color: item.senderId === auth.currentUser?.uid ? colors.text.light : colors.text.primary }
            ]}>{item.content}</Text>
            <Text style={[
              styles.messageTime,
              { color: item.senderId === auth.currentUser?.uid ? 'rgba(255,255,255,0.7)' : colors.text.tertiary }
            ]}>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#666"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={handleSend}
          disabled={!newMessage.trim()}>
          <Ionicons 
            name="send" 
            size={24} 
            color={newMessage.trim() ? '#007AFF' : '#666'} 
          />
        </TouchableOpacity>
      </View>

      <ImagePreviewModal
        visible={imagePreviewVisible}
        imageUrl={otherUser?.photoURL || null}
        onClose={() => setImagePreviewVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 70 : 20,
    paddingBottom: 16,
    paddingHorizontal: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    ...shadows.small,
    position: 'relative',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    position: 'absolute',
    left: 30,
    top: Platform.OS === 'ios' ? 70 : 20,
    zIndex: 1,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  chatHeaderText: {
    fontSize: typography.fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerRight: {
    width: 40,
    position: 'absolute',
    right: 16,
  },
  messagesList: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  messageContainer: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    shadowColor: shadows.small.shadowColor,
    shadowOffset: shadows.small.shadowOffset,
    shadowOpacity: shadows.small.shadowOpacity,
    shadowRadius: shadows.small.shadowRadius,
    elevation: shadows.small.elevation,
  } as ViewStyle,
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.ui.primary,
    borderBottomRightRadius: borderRadius.xs,
  } as ViewStyle,
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderBottomLeftRadius: borderRadius.xs,
  } as ViewStyle,
  messageText: {
    fontSize: typography.fontSize.md,
  } as TextStyle,
  messageTime: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  } as TextStyle,
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.ui.ghost,
    backgroundColor: colors.card,
    shadowColor: shadows.small.shadowColor,
    shadowOffset: shadows.small.shadowOffset,
    shadowOpacity: shadows.small.shadowOpacity,
    shadowRadius: shadows.small.shadowRadius,
    elevation: shadows.small.elevation,
  } as ViewStyle,
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    marginRight: spacing.md,
    maxHeight: 100,
  } as TextStyle,
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  loadingText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
    marginTop: spacing.xl,
  } as TextStyle,
  errorText: {
    color: colors.text.error,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
    marginTop: spacing.xl,
  } as TextStyle,
  warningBar: {
    backgroundColor: '#FFF3CD',
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  } as ViewStyle,
  warningText: {
    color: '#856404',
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    fontWeight: '500',
  } as TextStyle,
});