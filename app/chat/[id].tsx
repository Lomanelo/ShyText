import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  SafeAreaView,
  ActivityIndicator,
  Image,
  StatusBar,
  Alert,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { auth, sendMessage, subscribeToMessages, getProfile, getConversation, respondToConversation, markMessagesAsRead } from '../../src/lib/firebase';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import colors from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useUnreadMessages } from '../(tabs)/_layout';
import { setViewingConversation } from '../../src/lib/notifications';
import VerifiedBadge from '../../src/components/VerifiedBadge';

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
};

interface Conversation {
  id: string;
  otherUserId: string;
  status: string;
  isInitiator: boolean;
}

// Memoize the message component to prevent unnecessary rerenders
const MessageItem = memo(({ 
  message,
  isUserMessage,
  isFirstInGroup
}: { 
  message: Message,
  isUserMessage: boolean,
  isFirstInGroup: boolean
}) => {
  const messageStyles = [
    styles.messageContainer, 
    isUserMessage ? styles.userMessage : styles.otherMessage,
    isFirstInGroup && (isUserMessage ? styles.firstInGroupUser : styles.firstInGroupOther)
  ];

  const bubbleStyles = [
    styles.messageBubble,
    isUserMessage ? styles.userBubble : styles.otherBubble,
  ];

  return (
    <View style={messageStyles}>
      <View style={bubbleStyles}>
        <Text style={styles.messageText}>{message.content}</Text>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isUserMessage === nextProps.isUserMessage &&
    prevProps.isFirstInGroup === nextProps.isFirstInGroup
  );
});

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<string>('');
  const [isInitiator, setIsInitiator] = useState<boolean>(false);
  const [isResponding, setIsResponding] = useState(false);
  const { refreshUnreadCount } = useUnreadMessages();
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [initiatorMessageCount, setInitiatorMessageCount] = useState(0);
  const [messageLimitReached, setMessageLimitReached] = useState(false);

  const countInitiatorMessages = useCallback((msgs: Message[]) => {
    if (!isInitiator) return;
    
    const count = msgs.filter(msg => 
      msg.sender_id === auth.currentUser?.uid && 
      msg.sender_id !== 'system'
    ).length;
    
    setInitiatorMessageCount(count);
    
    if (conversationStatus === 'pending' && count >= 2) {
      setMessageLimitReached(true);
    } else {
      setMessageLimitReached(false);
    }
  }, [isInitiator, conversationStatus]);

  useEffect(() => {
    if (id) {
      setViewingConversation(id as string);
    }
    
    return () => {
      setViewingConversation(null);
    };
  }, [id]);

  useEffect(() => {
    fetchMessages();
    fetchConversationDetails();
    
    const markAsRead = async () => {
      try {
        if (id) {
          const updatedCount = await markMessagesAsRead(id as string);
          if (updatedCount > 0) {
            refreshUnreadCount();
          }
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };
    
    markAsRead();
    
    const unsubscribe = subscribeToMessages(id as string, (newMessages) => {
      const hasNewMessagesFromOther = newMessages.some(
        msg => !msg.read && msg.sender_id !== auth.currentUser?.uid
      );
      
      setMessages(newMessages as Message[]);
      
      countInitiatorMessages(newMessages as Message[]);
      
      if (hasNewMessagesFromOther) {
        markAsRead();
      }
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, [id, countInitiatorMessages]);

  useEffect(() => {
    if (otherUserId) {
      fetchOtherUser();
    }
  }, [otherUserId]);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: false });
        } catch (error) {
          console.log("Scroll error:", error);
        }
      }, 300);
    }
  }, [messages.length]);

  const fetchConversationDetails = async () => {
    try {
      if (!id) return;
      
      const result = await getConversation(id as string);
      if (result.success && result.conversation) {
        const conversation = result.conversation as Conversation;
        setOtherUserId(conversation.otherUserId);
        setConversationStatus(conversation.status);
        setIsInitiator(conversation.isInitiator);
      }
    } catch (err) {
      console.error("Error fetching conversation details:", err);
      setError("Failed to load conversation details");
    }
  };

  const fetchOtherUser = async () => {
    try {
      if (!otherUserId) return;
      
      const snapshot = await getProfile(otherUserId);
      if (snapshot) {
        setOtherUser(snapshot);
        setLoading(false);
      }
    } catch (err) {
      console.error("Error fetching other user:", err);
      setError("Failed to load user profile");
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(false);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages");
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    
    if (isInitiator && conversationStatus === 'pending' && initiatorMessageCount >= 2) {
      Alert.alert(
        'Message Limit Reached',
        'You can only send 2 messages until the other person accepts your conversation request.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const messageContent = newMessage.trim();
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      created_at: new Date().toISOString(), // Still need this for message order but we won't display it
      sender_id: auth.currentUser?.uid || '',
    };

    // Set the new message first
    setNewMessage('');
    
    // Then update the messages array with the optimistic message
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Scroll to bottom immediately after adding the message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 50);
    
    try {
      await sendMessage(id as string, messageContent);
      
      try {
        await markMessagesAsRead(id as string);
        refreshUnreadCount();
      } catch (error) {
        console.error('Error marking messages as read after sending:', error);
      }
    } catch (error) {
      // Remove the optimistic message if sending fails
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      console.error('Error sending message:', error);
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    }
  };

  const handleAcceptDecline = async (accept: boolean) => {
    if (isResponding) return;
    
    try {
      setIsResponding(true);
      await respondToConversation(id as string, accept);
      if (accept) {
        setConversationStatus('accepted');
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Error responding to conversation:', error);
      if (error instanceof Error && error.message !== 'This conversation is no longer pending') {
        Alert.alert('Error', 'Failed to respond to conversation request');
      }
    } finally {
      setIsResponding(false);
    }
  };

  const renderCustomHeader = () => {
    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome name="chevron-left" size={20} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerProfile}>
          <TouchableOpacity 
            onPress={() => {
              if (otherUser) {
                setShowProfileModal(true);
              }
            }}
          >
            {otherUser?.photo_url ? (
              <Image 
                source={{ uri: otherUser.photo_url }} 
                style={styles.headerAvatar} 
                onError={(e) => console.error("Error loading header avatar:", e.nativeEvent.error)}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarInitial}>
                  {otherUser?.display_name?.charAt(0) || '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    return (
      <View style={styles.dayDivider}>
        <Text style={styles.dayDividerText}>Today</Text>
      </View>
    );
  };

  // Use a memoized renderItem function for FlatList
  const renderMessage = useCallback(({ item, index }: { item: Message, index: number }) => {
    const isUserMessage = item.sender_id === auth.currentUser?.uid;
    const isSystemMessage = item.sender_id === 'system';
    
    // Handle system messages
    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      );
    }
    
    // Check if this message is the first in a group
    const isFirstInGroup = index === 0 || 
      messages[index - 1].sender_id !== item.sender_id || 
      (new Date(item.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 5 * 60 * 1000);
    
    return (
      <MessageItem 
        message={item}
        isUserMessage={isUserMessage}
        isFirstInGroup={isFirstInGroup}
      />
    );
  }, [messages]);

  // Use key extractor for FlatList optimization
  const keyExtractor = useCallback((item: Message) => item.id, []);

  const renderPendingBanner = () => {
    return (
      <View style={styles.pendingBanner}>
        <Text style={styles.pendingText}>Chat Request</Text>
        <View style={styles.pendingActions}>
          <TouchableOpacity
            style={[
              styles.pendingButton, 
              styles.declineButton,
              isResponding && styles.disabledButton
            ]}
            onPress={() => handleAcceptDecline(false)}
            disabled={isResponding}
          >
            {isResponding ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Text style={[styles.pendingButtonText, styles.declineButtonText]}>
                Decline
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pendingButton, 
              styles.acceptButton,
              isResponding && styles.disabledButton
            ]}
            onPress={() => handleAcceptDecline(true)}
            disabled={isResponding}
          >
            {isResponding ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <Text style={[styles.pendingButtonText, styles.acceptButtonText]}>
                Accept
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchMessages}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false
        }}
      />
      <StatusBar barStyle="dark-content" />
      
      {renderCustomHeader()}
      
      {conversationStatus === 'pending' && !isInitiator && renderPendingBanner()}
      
      {conversationStatus === 'pending' && isInitiator && messageLimitReached && (
        <View style={styles.messageLimitBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.messageLimitText}>
            You've sent 2 messages. Wait for a response to continue chatting.
          </Text>
        </View>
      )}
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.messagesContainer, { flexGrow: 1, justifyContent: 'flex-end' }]}
          onLayout={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={Platform.OS === 'android'}
          inverted={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />
        
        {(conversationStatus === 'accepted' || isInitiator) && (
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={messageLimitReached ? "Message limit reached. Wait for acceptance..." : "Type a message..."}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                placeholderTextColor={colors.darkGray}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                editable={!(isInitiator && conversationStatus === 'pending' && initiatorMessageCount >= 2)}
              />
            </View>
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!newMessage.trim() && { opacity: 0.5 }),
                (isInitiator && conversationStatus === 'pending' && initiatorMessageCount >= 2) && styles.sendButtonDisabled
              ]} 
              onPress={handleSend}
              disabled={!newMessage.trim() || (isInitiator && conversationStatus === 'pending' && initiatorMessageCount >= 2)}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
      
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowProfileModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.profileModalContainer}>
              <TouchableOpacity 
                style={styles.closeModalButton}
                onPress={() => setShowProfileModal(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              
              {/* Verification Badge */}
              {otherUser?.is_verified && (
                <View style={styles.verificationBadgeContainer}>
                  <VerifiedBadge isVerified={true} size="large" />
                </View>
              )}
              
              {otherUser?.photo_url ? (
                <Image 
                  source={{ uri: otherUser.photo_url }} 
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileImageText}>
                    {otherUser?.display_name?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              
              <View style={styles.profileInfo}>
                {otherUser?.display_name && (
                  <Text style={styles.profileName}>
                    {otherUser.display_name}
                  </Text>
                )}

                {otherUser?.age && (
                  <View style={styles.ageContainer}>
                    <Text style={styles.ageText}>{otherUser.age}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  innerContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.darkGray,
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  retryButtonText: {
    color: colors.background,
    fontWeight: '600',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dayDivider: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dayDividerText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.darkGray,
    backgroundColor: 'rgba(230, 230, 230, 0.8)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 2,
    alignItems: 'flex-end',
  },
  sentMessageRow: {
    justifyContent: 'flex-end',
  },
  receivedMessageRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    marginRight: 8,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  avatarInitial: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  spacer: {
    width: 32,
    marginLeft: 8,
  },
  messageContainer: {
    marginVertical: 2,
    paddingHorizontal: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  firstInGroupUser: {
    marginTop: 12,
  },
  firstInGroupOther: {
    marginTop: 12,
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: '#5EB1BF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#000000',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 2 : 8,
    borderTopWidth: 1,
    borderTopColor: colors.mediumGray,
    backgroundColor: colors.background,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginRight: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    maxHeight: 100,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    width: '100%',
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 12,
    zIndex: 10,
  },
  headerProfile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  headerAvatarInitial: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTextContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text
  },
  pendingBanner: {
    backgroundColor: colors.background,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    alignItems: 'center',
  },
  pendingText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  pendingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  pendingButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
  },
  pendingButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: colors.error,
  },
  declineButtonText: {
    color: colors.error,
  },
  acceptButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: colors.success,
  },
  acceptButtonText: {
    color: colors.success,
  },
  disabledButton: {
    opacity: 0.5,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 14,
    color: colors.darkGray,
    textAlign: 'center',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  messagesContainer: {
    paddingBottom: 20,
    paddingTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalContainer: {
    width: '90%',
    backgroundColor: 'transparent',
    borderRadius: 24,
    padding: 0,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeModalButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  profileImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 0.75,
    borderRadius: 24,
  },
  profileImagePlaceholder: {
    width: '100%',
    height: undefined,
    aspectRatio: 0.75,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  profileImageText: {
    color: colors.background,
    fontSize: 80,
    fontWeight: 'bold',
  },
  profileInfo: {
    padding: 0,
    width: '100%',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '600',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 8,
  },
  ageContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  ageText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '500',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 10,
    padding: 2,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  verifiedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  messageLimitBanner: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageLimitText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 8,
    flex: 1,
  },
  verificationBadgeContainer: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 6,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
});