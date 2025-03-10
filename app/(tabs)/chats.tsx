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
    const isRead = item.status !== 'unread';
    
    return (
      <TouchableOpacity 
        style={[styles.conversationItem, !isRead && styles.unreadConversationItem]}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.conversationAvatarContainer}>
          {item.otherUser?.photo_url ? (
            <Image 
              source={{ uri: item.otherUser.photo_url }} 
              style={styles.conversationAvatar} 
            />
          ) : (
            <View style={styles.conversationAvatarPlaceholder}>
              <Text style={styles.conversationAvatarInitial}>
                {item.otherUser?.display_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {isPending && !item.isInitiator && (
            <View style={styles.pendingIndicator}>
              <Ionicons name="time-outline" size={12} color={colors.background} />
            </View>
          )}
        </View>
        
        <View style={styles.conversationDetails}>
          <View style={styles.conversationHeader}>
            <Text style={[
              styles.conversationName,
              !isRead && styles.unreadConversationName
            ]} numberOfLines={1}>
              {item.otherUser?.display_name || 'Unknown User'}
            </Text>
            <Text style={styles.conversationTime}>
              {formatTime(item.last_message_time)}
            </Text>
          </View>
          
          <View style={styles.conversationPreview}>
            {isPending && !item.isInitiator ? (
              <Text style={styles.pendingText}>
                Chat request pending...
              </Text>
            ) : (
              <Text style={[
                styles.conversationMessage,
                !isRead && styles.unreadConversationMessage
              ]} numberOfLines={1}>
                {item.last_message || 'No messages yet'}
              </Text>
            )}
            
            {!isRead && (
              <View style={styles.unreadIndicator} />
            )}
          </View>
        </View>
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

      {/* Chat Request Modal */}
      <Modal
        visible={showRequestModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRequestModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRequestModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Chat Request</Text>
              <TouchableOpacity
                onPress={() => setShowRequestModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.darkGray} />
              </TouchableOpacity>
            </View>
            
            {pendingConversation && (
              <View style={styles.modalContent}>
                <View style={styles.profileImageContainer}>
                  {pendingConversation.otherUser.photo_url ? (
                    <Image
                      source={{ uri: pendingConversation.otherUser.photo_url }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <Text style={styles.profileImageInitial}>
                        {pendingConversation.otherUser.display_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.requestUsername}>
                  {pendingConversation.otherUser.display_name}
                </Text>
                
                <View style={styles.messageContainer}>
                  <Text style={styles.messageLabel}>First Message:</Text>
                  <View style={styles.messageBubble}>
                    <Text style={styles.messageText}>{pendingConversation.firstMessage}</Text>
                  </View>
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => {
                      handleConversationResponse(pendingConversation.id, false);
                      setShowRequestModal(false);
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} style={styles.actionIcon} />
                    <Text style={[styles.actionText, styles.rejectText]}>Decline</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => {
                      handleConversationResponse(pendingConversation.id, true);
                      setShowRequestModal(false);
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} style={styles.actionIcon} />
                    <Text style={[styles.actionText, styles.acceptText]}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const formatTime = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
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
  } catch (e) {
    console.error("Error formatting date:", e);
    return '';
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  unreadConversationItem: {
    backgroundColor: 'rgba(0, 173, 181, 0.04)', // Very subtle highlight for unread
  },
  conversationAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  conversationAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  conversationAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationAvatarInitial: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
  },
  pendingIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  conversationDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    color: colors.text,
    marginRight: 8,
  },
  unreadConversationName: {
    fontWeight: '700',
  },
  conversationTime: {
    fontSize: 14,
    color: colors.darkGray,
  },
  conversationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationMessage: {
    fontSize: 15,
    color: colors.darkGray,
    flex: 1,
    marginRight: 8,
  },
  unreadConversationMessage: {
    color: colors.text,
    fontWeight: '500',
  },
  pendingText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.primary,
    flex: 1,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: colors.background,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalContent: {
    padding: 20,
    alignItems: 'center',
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageInitial: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
  },
  requestUsername: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  messageContainer: {
    width: '100%',
    marginBottom: 24,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkGray,
    marginBottom: 8,
  },
  messageBubble: {
    backgroundColor: colors.lightGray,
    padding: 16,
    borderRadius: 12,
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  acceptButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  actionIcon: {
    marginRight: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  rejectText: {
    color: colors.error,
  },
  acceptText: {
    color: colors.success,
  },
});