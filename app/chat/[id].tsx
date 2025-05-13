import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, ViewStyle, TextStyle, ImageStyle, Alert } from 'react-native';
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
  const [isBlocked, setIsBlocked] = useState(false);
  const [senderInfo, setSenderInfo] = useState<{name: string, id: string} | null>(null);
  const [receiverPushToken, setReceiverPushToken] = useState<string | null>(null);
  const [receiverActive, setReceiverActive] = useState(false);

  // Add function to check if user is blocked
  const checkIfBlocked = async () => {
    if (!currentUser || !otherUser) return;
    
    try {
      const db = getDatabase();
      const blockedRef = ref(db, `blockedUsers/${currentUser.uid}/${otherUser.id}`);
      const snapshot = await get(blockedRef);
      setIsBlocked(snapshot.exists());
    } catch (error) {
      console.error('Error checking blocked status:', error);
    }
  };

  // Add function to handle blocking/unblocking
  const handleBlockUser = async () => {
    if (!currentUser || !otherUser) return;

    try {
      const db = getDatabase();
      const blockedRef = ref(db, `blockedUsers/${currentUser.uid}/${otherUser.id}`);
      
      if (isBlocked) {
        // Unblock user
        await set(blockedRef, null);
        setIsBlocked(false);
        Alert.alert('Success', 'User has been unblocked');
      } else {
        // Block user
        Alert.alert(
          'Block User',
          'Are you sure you want to block this user? They will not be able to send you messages.',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                await set(blockedRef, {
                  blockedAt: new Date().toISOString(),
                  blockedUserId: otherUser.id
                });
                setIsBlocked(true);
                Alert.alert('Success', 'User has been blocked');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error blocking/unblocking user:', error);
      Alert.alert('Error', 'Failed to update block status');
    }
  };

  // Add effect to check blocked status when chat loads
  useEffect(() => {
    checkIfBlocked();
  }, [otherUser]);

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

  // Add function to check if either user has blocked the other
  const checkIfEitherUserBlocked = async () => {
    if (!currentUser || !otherUser) return false;
    
    try {
      const db = getDatabase();
      // Check if current user blocked other user
      const currentUserBlockedRef = ref(db, `blockedUsers/${currentUser.uid}/${otherUser.id}`);
      const currentUserBlockedSnapshot = await get(currentUserBlockedRef);
      
      // Check if other user blocked current user
      const otherUserBlockedRef = ref(db, `blockedUsers/${otherUser.id}/${currentUser.uid}`);
      const otherUserBlockedSnapshot = await get(otherUserBlockedRef);
      
      return currentUserBlockedSnapshot.exists() || otherUserBlockedSnapshot.exists();
    } catch (error) {
      console.error('Error checking block status:', error);
      return false;
    }
  };

  // Add a more efficient notification system
  useEffect(() => {
    if (!otherUser || !currentUser) return;
    
    // Pre-load sender information to avoid delays when sending messages
    const db = getDatabase();
    const senderProfileRef = ref(db, `profiles/${currentUser.uid}`);
    
    // Cache sender profile data to avoid repeated lookups
    get(senderProfileRef).then(snapshot => {
      if (snapshot.exists()) {
        const senderProfile = snapshot.val();
        // Store in component state for quick access
        setSenderInfo({
          name: senderProfile.firstName || senderProfile.displayName || currentUser.displayName || 'User',
          id: currentUser.uid
        });
      }
    }).catch(console.error);
    
    // Also pre-fetch receiver's push token
    const receiverProfileRef = ref(db, `profiles/${otherUser.id}`);
    get(receiverProfileRef).then(snapshot => {
      if (snapshot.exists()) {
        const receiverProfile = snapshot.val();
        if (receiverProfile.expoPushToken) {
          // Store token for immediate use when sending messages
          setReceiverPushToken(receiverProfile.expoPushToken);
        }
      }
    }).catch(console.error);
    
  }, [currentUser, otherUser]);

  // Add effect to monitor receiver's active status
  useEffect(() => {
    if (!id || !otherUser) return;
    
    const db = getDatabase();
    const activeChatRef = ref(db, `activeChats/${id}/${otherUser.id}`);
    
    const unsubscribeActive = onValue(activeChatRef, (snapshot) => {
      setReceiverActive(snapshot.exists() && snapshot.val()?.isActive);
    });
    
    return () => {
      unsubscribeActive();
    };
  }, [id, otherUser]);

  // Optimize the handleSend function for faster notifications
  const handleSend = async () => {
    if (!newMessage.trim() || !id || typeof id !== 'string') return;

    // Store message text and clear input immediately
    const messageToSend = newMessage.trim();
    setNewMessage('');

    try {
      if (!currentUser) throw new Error('You must be logged in');
      
      // Check if either user has blocked the other
      const isBlocked = await checkIfEitherUserBlocked();
      if (isBlocked) {
        Alert.alert(
          'Cannot Send Message',
          'This conversation has been blocked. You cannot send messages to this user.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const db = getDatabase();
      const messagesPath = 'messages/' + id;
      const messagesRef = ref(db, messagesPath);
      
      // Create message data
      const messageData = {
        content: messageToSend,
        senderId: currentUser.uid,
        createdAt: new Date().toISOString()
      };
      
      // Immediately send notification if receiver is not active
      // This runs in parallel with message sending for faster notifications
      if (otherUser && receiverPushToken && !receiverActive) {
        sendPushNotification(
          receiverPushToken,
          `New message from ${senderInfo?.name || currentUser.displayName || 'Someone'}`,
          messageToSend,
          { 
            type: 'chat',
            chatId: id,
            senderId: currentUser.uid,
            senderName: senderInfo?.name || currentUser.displayName || 'Someone'
          }
        ).catch(console.error);
      }
      
      // Send message to Firebase
      const newMessageRef = push(messagesRef);
      set(newMessageRef, messageData).catch(console.error);
      
      // Handle conversation updates in background
      Promise.all([
        // Update conversation metadata
        (async () => {
          try {
            const conversationRef = ref(db, 'conversations/' + id);
            const conversationSnapshot = await get(conversationRef);
            
            if (!conversationSnapshot.exists()) return;
            
            const currentConversation = conversationSnapshot.val();
            const messagesSnapshot = await get(messagesRef);
            
            const isFirstMessage = !messagesSnapshot.exists() || 
              Object.keys(messagesSnapshot.val()).length <= 1;
              
            let hasReceiverResponded = false;
            
            if (currentConversation.firstSenderId === currentUser.uid && messagesSnapshot.exists()) {
              hasReceiverResponded = Object.values(messagesSnapshot.val()).some((msg: any) => 
                msg.senderId !== currentUser.uid
              );
            }
            
            const updatedConversation = {
              ...currentConversation,
              lastMessage: messageToSend,
              lastMessageTime: new Date().toISOString()
            };
            
            if (isFirstMessage) {
              updatedConversation.firstSenderId = currentUser.uid;
              updatedConversation.firstSenderMessageCount = 1;
            } else if (currentConversation.firstSenderId === currentUser.uid && !hasReceiverResponded) {
              updatedConversation.firstSenderMessageCount = 
                (currentConversation.firstSenderMessageCount || 0) + 1;
              
              if (updatedConversation.firstSenderMessageCount >= 3) {
                setWarningMessage('Wait for a response before sending more messages');
              }
            }
            
            await set(conversationRef, updatedConversation);
          } catch (error) {
            console.error('Error updating conversation:', error);
          }
        })()
      ]).catch(console.error);
      
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Optimize the messages listener to make message updates faster for the receiver
  useEffect(() => {
    if (!id || typeof id !== 'string' || !currentUser) return;
    
    const db = getDatabase();
    const messagesPath = 'messages/' + id;
    const messagesRef = ref(db, messagesPath);
    
    // Use serverTimestamp for better real-time ordering
    const messagesQuery = query(messagesRef, orderByChild('createdAt'));
    
    // Create a faster listener with optimized batch updates
    const unsubscribeMessages = onValue(messagesQuery, (snapshot) => {
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messagesList: Message[] = [];
        const unreadMessages: Record<string, any> = {};
        let hasUnread = false;
        
        // Process messages in a single pass for better performance
        Object.entries(messagesData).forEach(([key, value]) => {
          const message = value as any;
          messagesList.push({
            id: key,
            ...message
          });
          
          // Collect unread messages for batch update
          if (message.senderId !== currentUser.uid && !message.read) {
            hasUnread = true;
            unreadMessages[key] = {
              ...message,
              read: true
            };
          }
        });
        
        // Sort by timestamp for consistent order
        messagesList.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        // Update messages state first for immediate UI update
        setMessages(messagesList);
        
        // Then handle read receipts as a background operation
        if (hasUnread) {
          // Use a more efficient batch update for marking messages as read
          const updates: Record<string, any> = {};
          
          Object.entries(unreadMessages).forEach(([key, message]) => {
            updates[`${messagesPath}/${key}`] = message;
          });
          
          const batchUpdateRef = ref(db);
          set(batchUpdateRef, updates).catch(err => 
            console.error('Error marking messages as read:', err)
          );
        }
      } else {
        setMessages([]);
      }
      
      setLoading(false);
    });
    
    return () => {
      unsubscribeMessages();
    };
  }, [id, currentUser]);

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
        <TouchableOpacity 
          style={styles.blockButton}
          onPress={handleBlockUser}>
          <Ionicons 
            name={isBlocked ? "lock-closed" : "lock-open"} 
            size={24} 
            color={isBlocked ? colors.text.error : colors.text.secondary} 
          />
        </TouchableOpacity>
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
        contentContainerStyle={[
          styles.messagesList,
          { paddingBottom: 50 }
        ]}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 50);
        }}
        onLayout={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
        }}
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
    paddingBottom: spacing.xxl * 2,
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
  blockButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    position: 'absolute',
    right: 30,
    top: Platform.OS === 'ios' ? 70 : 20,
    zIndex: 1,
  },
});