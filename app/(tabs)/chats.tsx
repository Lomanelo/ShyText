import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserConversations, respondToConversation, getFirstMessage } from '../../src/lib/firebase';
import colors from '../../src/theme/colors';

interface Conversation {
  id: string;
  status: string;
  last_message: string;
  last_message_time: string;
  isInitiator: boolean;
  otherUser: {
    display_name: string;
    photo_url?: string;
  };
}

export default function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConversation, setPendingConversation] = useState<{
    id: string;
    otherUser: { display_name: string; photo_url?: string };
    firstMessage: string;
  } | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const loadConversations = async () => {
    try {
      const result = await getUserConversations();
      // Transform the data to match the Conversation interface
      const transformedConversations: Conversation[] = result.conversations.map((conv: any) => ({
        id: conv.id,
        status: conv.status || 'active',
        last_message: conv.last_message?.content || 'No messages yet',
        last_message_time: conv.last_message?.timestamp || conv.created_at,
        isInitiator: conv.isInitiator,
        otherUser: {
          display_name: conv.otherUser?.display_name || 'Unknown User',
          photo_url: conv.otherUser?.photo_url,
        },
      }));
      setConversations(transformedConversations);
      setError(null);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, []);

  const handleConversationPress = async (conversation: Conversation) => {
    if (conversation.status === 'pending' && !conversation.isInitiator) {
      try {
        // Show loading indicator while fetching the first message
        setLoading(true);
        
        // Get the first message of this conversation
        const firstMessageResult = await getFirstMessage(conversation.id);
        
        setLoading(false);
        
        if (firstMessageResult.success && firstMessageResult.message) {
          // Access the content safely with type assertion
          const messageContent = (firstMessageResult.message as any).content || "No message content";
          
          // Show the custom request modal with the first message
          setPendingConversation({
            id: conversation.id,
            otherUser: conversation.otherUser,
            firstMessage: messageContent
          });
          setShowRequestModal(true);
        } else {
          // Fallback to the standard alert if we can't get the first message
          Alert.alert(
            'New Conversation Request',
            `${conversation.otherUser.display_name} would like to chat with you. Would you like to accept?`,
            [
              {
                text: 'Decline',
                style: 'cancel',
                onPress: () => handleConversationResponse(conversation.id, false),
              },
              {
                text: 'Accept',
                onPress: () => handleConversationResponse(conversation.id, true),
              },
            ]
          );
        }
      } catch (error) {
        setLoading(false);
        console.error('Error getting first message:', error);
        // Fallback to the old dialog if there's an error
        Alert.alert(
          'New Conversation Request',
          `${conversation.otherUser.display_name} would like to chat with you. Would you like to accept?`,
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: () => handleConversationResponse(conversation.id, false),
            },
            {
              text: 'Accept',
              onPress: () => handleConversationResponse(conversation.id, true),
            },
          ]
        );
      }
    } else {
      // Navigate to chat screen
      router.push(`/chat/${conversation.id}`);
    }
  };

  const handleConversationResponse = async (conversationId: string, accept: boolean) => {
    try {
      await respondToConversation(conversationId, accept);
      if (accept) {
        router.push(`/chat/${conversationId}`);
      } else {
        // Refresh the conversations list
        loadConversations();
      }
      // Hide the modal if it's open
      setShowRequestModal(false);
      setPendingConversation(null);
    } catch (err) {
      console.error('Error responding to conversation:', err);
      Alert.alert('Error', 'Failed to respond to conversation request');
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const isPending = item.status === 'pending';
    const isDeclined = item.status === 'declined';

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          isPending && !item.isInitiator && styles.pendingConversation,
          isDeclined && styles.declinedConversation,
        ]}
        onPress={() => handleConversationPress(item)}
        disabled={isDeclined}
      >
        <View style={styles.avatarContainer}>
          {item.otherUser.photo_url ? (
            <Image
              source={{ uri: item.otherUser.photo_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {item.otherUser.display_name.charAt(0)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.otherUser.display_name}</Text>
            <Text style={styles.time}>
              {formatTime(item.last_message_time)}
            </Text>
          </View>

          <View style={styles.messageRow}>
            {isPending && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {item.isInitiator ? 'Pending' : 'New Request'}
                </Text>
              </View>
            )}
            {isDeclined && (
              <View style={[styles.statusBadge, styles.declinedBadge]}>
                <Text style={styles.statusText}>Declined</Text>
              </View>
            )}
            {!isPending && !isDeclined && (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message}
              </Text>
            )}
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={24}
          color={colors.mediumGray}
          style={styles.chevron}
        />
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadConversations}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={60}
              color={colors.mediumGray}
            />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Find people nearby to start chatting!
            </Text>
          </View>
        }
      />

      {/* Conversation Request Modal */}
      <Modal
        visible={showRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Conversation</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setShowRequestModal(false);
                  setPendingConversation(null);
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {pendingConversation && (
              <View style={styles.requestContent}>
                <View style={styles.userInfoContainer}>
                  {pendingConversation.otherUser.photo_url ? (
                    <Image 
                      source={{ uri: pendingConversation.otherUser.photo_url }} 
                      style={styles.userPhoto}
                    />
                  ) : (
                    <View style={styles.userPhotoPlaceholder}>
                      <Text style={styles.userInitial}>
                        {pendingConversation.otherUser.display_name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.userName}>{pendingConversation.otherUser.display_name}</Text>
                  <Text style={styles.requestLabel}>wants to chat with you</Text>
                </View>
                
                <View style={styles.messageContainer}>
                  <Text style={styles.messageLabel}>First Message:</Text>
                  <View style={styles.messageBubble}>
                    <Text style={styles.messageText}>{pendingConversation.firstMessage}</Text>
                  </View>
                </View>
                
                <Text style={styles.questionText}>Would you like to continue this conversation?</Text>
                
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={() => handleConversationResponse(pendingConversation.id, false)}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.background} />
                    <Text style={styles.actionButtonText}>Decline</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleConversationResponse(pendingConversation.id, true)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={colors.background} />
                    <Text style={styles.actionButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 7 * oneDay) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: colors.background,
    fontSize: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  pendingConversation: {
    backgroundColor: colors.lightGray,
  },
  declinedConversation: {
    opacity: 0.5,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.background,
    fontSize: 20,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  time: {
    fontSize: 12,
    color: colors.darkGray,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: colors.darkGray,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  declinedBadge: {
    backgroundColor: colors.error,
  },
  statusText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.darkGray,
    marginTop: 8,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 15,
    width: '90%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 5,
  },
  requestContent: {
    alignItems: 'center',
  },
  userInfoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  userPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInitial: {
    fontSize: 36,
    color: colors.background,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  requestLabel: {
    fontSize: 16,
    color: colors.darkGray,
  },
  messageContainer: {
    width: '100%',
    marginVertical: 20,
  },
  messageLabel: {
    fontSize: 16,
    color: colors.darkGray,
    marginBottom: 8,
  },
  messageBubble: {
    backgroundColor: colors.lightGray,
    borderRadius: 15,
    padding: 15,
    width: '100%',
  },
  messageText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  questionText: {
    fontSize: 18,
    color: colors.text,
    marginVertical: 20,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    flex: 0.48,
  },
  acceptButton: {
    backgroundColor: colors.primary,
  },
  declineButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});