import { useState, useEffect, useRef } from 'react';
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
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { auth, sendMessage, subscribeToMessages, getProfile, getConversation, respondToConversation, markMessagesAsRead } from '../../src/lib/firebase';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import colors from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useUnreadMessages } from '../(tabs)/_layout';

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

  useEffect(() => {
    fetchMessages();
    fetchConversationDetails();
    
    // Mark messages as read when the conversation is opened
    const markAsRead = async () => {
      try {
        if (id) {
          const updatedCount = await markMessagesAsRead(id as string);
          if (updatedCount > 0) {
            // Only refresh if messages were actually marked as read
            refreshUnreadCount();
          }
        }
      } catch (error) {
        // Silently handle errors to prevent disrupting the user experience
        console.error('Error marking messages as read:', error);
      }
    };
    
    markAsRead();
    
    const unsubscribe = subscribeToMessages(id as string, (newMessages) => {
      // Check if there are new messages from the other user
      const hasNewMessagesFromOther = newMessages.some(
        msg => !msg.read && msg.sender_id !== auth.currentUser?.uid
      );
      
      setMessages(newMessages as Message[]);
      
      // If there are new messages from the other user, mark them as read
      if (hasNewMessagesFromOther) {
        markAsRead();
      }
      
      // Scroll to bottom after new messages arrive
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    if (otherUserId) {
      fetchOtherUser();
    }
  }, [otherUserId]);

  useEffect(() => {
    // Scroll to top when keyboard appears or disappears (in inverted list this is the most recent message)
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({ 
            index: 0,
            animated: true
          });
        } catch (error) {
          console.log("Scroll error:", error);
        }
      }, 100);
    }
  }, [isInputFocused, messages.length]);

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
    
    try {
      await sendMessage(id as string, newMessage.trim());
      setNewMessage('');
      
      // After sending a message, check and mark any unread messages from the other person
      try {
        await markMessagesAsRead(id as string);
        refreshUnreadCount();
      } catch (error) {
        // Silently handle errors to avoid disrupting the user experience
        console.error('Error marking messages as read after sending:', error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    }
  };

  const handleAcceptDecline = async (accept: boolean) => {
    if (isResponding) return; // Prevent double-clicks
    
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
      // Only show alert if it's not already accepted
      if (error instanceof Error && error.message !== 'This conversation is no longer pending') {
        Alert.alert('Error', 'Failed to respond to conversation request');
      }
    } finally {
      setIsResponding(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const oneDay = 24 * 60 * 60 * 1000;

      if (diff < oneDay) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diff < 7 * oneDay) {
        return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${date.toLocaleDateString([], { weekday: 'short' })}`;
      } else {
        return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
      }
    } catch (e) {
      console.error("Error formatting date:", e);
      return '';
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
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherUser?.display_name || 'User'}
            </Text>
          </View>
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

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    // Check if this is a system message
    const isSystemMessage = item.sender_id === 'system';
    
    // For non-system messages, handle as before
    const isCurrentUser = !isSystemMessage && item.sender_id === auth.currentUser?.uid;
    
    // Determine if this is the first message in a sequence from this sender
    // System messages always break the sequence
    const isFirstInSequence = index === 0 || 
      messages[index - 1]?.sender_id !== item.sender_id ||
      isSystemMessage || 
      messages[index - 1]?.sender_id === 'system';
    
    // Determine if this is the last message in a sequence from this sender
    // System messages always break the sequence
    const isLastInSequence = index === messages.length - 1 || 
      messages[index + 1]?.sender_id !== item.sender_id ||
      isSystemMessage || 
      messages[index + 1]?.sender_id === 'system';
    
    // Show timestamp only for the last message in a sequence
    const showTimestamp = isLastInSequence;
    
    // If it's a system message, render it differently
    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
          <Text style={styles.systemMessageTime}>{formatTime(item.created_at)}</Text>
        </View>
      );
    }
    
    // For regular messages
    return (
      <View style={[
        styles.messageRow,
        isCurrentUser ? styles.sentMessageRow : styles.receivedMessageRow,
        // Add extra margin for first message in a sequence
        isFirstInSequence && { marginTop: 8 }
      ]}>
        {/* Show avatar only for the first message in a sequence from the other user */}
        {!isCurrentUser ? (
          <View style={[
            styles.avatarContainer,
            !isFirstInSequence && { opacity: 0 } // Hide avatar visually but keep space for alignment
          ]}>
            {isFirstInSequence && otherUser && (
              otherUser.photo_url ? (
                <Image 
                  source={{ uri: otherUser.photo_url }} 
                  style={styles.avatar} 
                  onError={(e) => console.error("Error loading message avatar:", e.nativeEvent.error)}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {otherUser?.display_name?.charAt(0) || '?'}
                  </Text>
                </View>
              )
            )}
          </View>
        ) : (
          <View style={styles.spacer} />
        )}
        
        <View style={[
          styles.messageContainer,
          isCurrentUser ? styles.sentMessage : styles.receivedMessage,
          !isLastInSequence && { marginBottom: 2 }, // Tighter grouping for consecutive messages
          isFirstInSequence && !isLastInSequence && (
            isCurrentUser 
              ? { borderBottomRightRadius: 4 } 
              : { borderBottomLeftRadius: 4 }
          ),
          !isFirstInSequence && !isLastInSequence && { borderRadius: 12 },
          !isFirstInSequence && isLastInSequence && (
            isCurrentUser 
              ? { borderTopRightRadius: 4 } 
              : { borderTopLeftRadius: 4 }
          )
        ]}>
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.sentMessageText : styles.receivedMessageText
          ]}>
            {item.content}
          </Text>
          {showTimestamp && (
            <Text style={[
              styles.messageTime,
              isCurrentUser ? styles.sentMessageTime : styles.receivedMessageTime
            ]}>
              {formatTime(item.created_at)}
            </Text>
          )}
        </View>
        
        {isCurrentUser && (
          <View style={[
            styles.avatarContainer,
            { opacity: 0 } // Invisible spacer for sent messages
          ]} />
        )}
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
          headerTitle: otherUser?.display_name || 'Chat'
        }}
      />
      
      {/* Custom header */}
      {renderCustomHeader()}
      
      <KeyboardAvoidingView 
        style={styles.innerContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        {conversationStatus === 'pending' && !isInitiator && (
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
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={{
            paddingBottom: isInputFocused ? 10 : 20,
          }}
          inverted
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
        />

        {(conversationStatus === 'accepted' || isInitiator) && (
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Message"
                placeholderTextColor={colors.darkGray}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={1000}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </View>
            <TouchableOpacity 
              style={[
                styles.sendButton,
                newMessage.trim().length === 0 && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={newMessage.trim().length === 0}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={newMessage.trim().length === 0 ? colors.darkGray : colors.background} 
              />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
    maxWidth: '75%',
    minWidth: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
  },
  sentMessage: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    marginLeft: 8,
  },
  receivedMessage: {
    backgroundColor: colors.lightGray,
    borderBottomLeftRadius: 4,
    marginRight: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  sentMessageText: {
    color: colors.background,
  },
  receivedMessageText: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  sentMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedMessageTime: {
    color: colors.darkGray,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
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
    justifyContent: 'flex-start',
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
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
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
  systemMessageTime: {
    fontSize: 10,
    color: colors.darkGray,
    marginTop: 4,
  },
});