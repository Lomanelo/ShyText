import { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, ViewStyle, TextStyle, ImageStyle, Alert, Animated, Keyboard } from 'react-native';
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
  isOptimistic?: boolean;
  sendFailed?: boolean;
  tempId?: string;
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
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const nextMessageIdRef = useRef(0);
  const messageMapRef = useRef<Map<string, boolean>>(new Map());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // More reliable message merging that prevents flickering
  const displayMessages = useMemo(() => {
    // Create a map of message IDs from the server messages
    const messageMap = new Map<string, boolean>();
    messages.forEach(msg => {
      messageMap.set(msg.id, true);
      
      // Also check if this message has a tempId that matches an optimistic message
      if (msg.tempId) {
        messageMapRef.current.set(msg.tempId, true);
      }
    });
    
    // Filter out optimistic messages that have been confirmed
    const filteredOptimisticMessages = optimisticMessages.filter(
      msg => !messageMapRef.current.has(msg.id)
    );
    
    // Combine and sort messages
    return [...messages, ...filteredOptimisticMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages, optimisticMessages]);

  // Reset the message map when component unmounts
  useEffect(() => {
    return () => {
      messageMapRef.current.clear();
    };
  }, []);

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
    
    const unsubscribeMessages = onValue(messagesQuery, (snapshot) => {
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messagesList: Message[] = [];
        const messagesToMarkAsRead: string[] = [];
        let hasUnread = false;
        
        Object.entries(messagesData).forEach(([key, value]) => {
          const message = value as any;
          
          // Create message object with ID and all properties
          const messageObj = {
            id: key,
            ...message
          };
          
          messagesList.push(messageObj);
          
          // Track tempId if it exists for matching with optimistic messages
          if (message.tempId) {
            messageMapRef.current.set(message.tempId, true);
          }
          
          // Collect IDs of unread messages from other user
          if (message.senderId !== currentUser.uid && !message.read) {
            hasUnread = true;
            messagesToMarkAsRead.push(key);
          }
        });
        
        // Sort messages by timestamp
        messagesList.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        // Update messages
        setMessages(messagesList);
        
        // Handle read receipts safely one at a time
        if (hasUnread && messagesToMarkAsRead.length > 0) {
          // Process messages safely one at a time
          let processedCount = 0;
          
          const processNextMessage = () => {
            if (processedCount >= messagesToMarkAsRead.length) return;
            
            const messageId = messagesToMarkAsRead[processedCount];
            processedCount++;
            
            // Use direct path to avoid issues with message key construction
            const messageRef = ref(db, `messages/${id}/${messageId}`);
            get(messageRef)
              .then(msgSnapshot => {
                if (msgSnapshot.exists()) {
                  const msgData = msgSnapshot.val();
                  return set(messageRef, {
                    ...msgData,
                    read: true
                  });
                }
                return null;
              })
              .then(() => {
                // Continue with next message after successful update
                processNextMessage();
              })
              .catch(error => {
                console.error(`Error marking message ${messageId} as read:`, error);
                // Continue with next message even after error
                processNextMessage();
              });
          };
          
          // Start processing messages
          processNextMessage();
        }
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

  // Add keyboard detection for better input positioning
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    
    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Optimized send function without flickering
  const handleSend = () => {
    if (!newMessage.trim() || !id || typeof id !== 'string' || !currentUser) return;
    
    // Store message text and clear input immediately
    const messageToSend = newMessage.trim();
    setNewMessage('');
    
    // Create optimistic message with a unique ID
    const tempId = `temp-${Date.now()}-${nextMessageIdRef.current++}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: messageToSend,
      senderId: currentUser.uid,
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };
    
    // Add optimistic message to state for instant display
    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    
    // Scroll to bottom immediately
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);
    
    // Send message in background
    (async () => {
      try {
        // Check if blocked
        const isBlocked = await checkIfEitherUserBlocked();
        if (isBlocked) {
          // Remove optimistic message if blocked
          setOptimisticMessages(prev => prev.filter(msg => msg.id !== tempId));
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
        
        // Send notification if needed
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
        
        // Create message data with tempId to match with optimistic message
        const messageData = {
          content: messageToSend,
          senderId: currentUser.uid,
          createdAt: new Date().toISOString(),
          tempId: tempId // Add tempId to match with optimistic message
        };
        
        // Send message to Firebase
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, messageData);
        
        // Add to the message map to prevent flickering
        messageMapRef.current.set(tempId, true);
        
        // Remove optimistic message after a delay to ensure smooth transition
        setTimeout(() => {
          setOptimisticMessages(prev => prev.filter(msg => msg.id !== tempId));
        }, 300);
        
        // Handle conversation updates in background
        updateConversationMetadata(messageToSend).catch(console.error);
        
      } catch (err) {
        console.error('Error sending message:', err);
        
        // Mark optimistic message as failed without removing it
        setOptimisticMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, sendFailed: true }
              : msg
          )
        );
      }
    })();
  };
  
  // Helper function to update conversation metadata
  const updateConversationMetadata = async (messageText: string) => {
    if (!currentUser || !id) return;
    
    try {
      const db = getDatabase();
      const messagesPath = 'messages/' + id;
      const messagesRef = ref(db, messagesPath);
      const conversationRef = ref(db, 'conversations/' + id);
      
      const [messagesSnapshot, conversationSnapshot] = await Promise.all([
        get(messagesRef),
        get(conversationRef)
      ]);
      
      if (!conversationSnapshot.exists()) return;
      
      const currentConversation = conversationSnapshot.val();
      
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
        lastMessage: messageText,
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? -5 : 0}>
      
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
        data={displayMessages}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageContainer,
              item.senderId === auth.currentUser?.uid ? 
                styles.sentMessage : 
                styles.receivedMessage,
              item.sendFailed && styles.failedMessage
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
              {item.sendFailed && ' • Failed'}
            </Text>
            {item.sendFailed && (
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  // Remove failed message and try again
                  setOptimisticMessages(prev => prev.filter(msg => msg.id !== item.id));
                  setNewMessage(item.content);
                }}>
                <Ionicons name="refresh" size={16} color="#FF3B30" />
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.messagesList,
          { paddingBottom: 50 }
        ]}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
        onLayout={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
        showsVerticalScrollIndicator={false}
        
        // Performance optimizations
        removeClippedSubviews={false}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        initialNumToRender={10}
      />

      <View style={[
        styles.inputContainer,
        keyboardVisible && styles.inputContainerWithKeyboard
      ]}>
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
  failedMessage: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
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
  inputContainerWithKeyboard: {
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : 0,
    marginBottom: 0,
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  } as ViewStyle,
  retryText: {
    color: '#FF3B30',
    fontSize: typography.fontSize.xs,
    marginLeft: 4,
    fontWeight: '500',
  } as TextStyle,
});