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
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../src/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, getDoc, doc, getDocs, limit } from 'firebase/firestore';
import colors from '../../src/theme/colors';
import { useUnreadMessages } from './_layout';

interface Conversation {
  id: string;
  initiator_id: string;
  receiver_id: string;
  accepted?: boolean;
  status?: string;
  last_message?: string;
  last_message_time: string;
  updated_at: string;
  isInitiator: boolean;
  otherUser?: {
    display_name: string;
    photo_url?: string;
    deleted?: boolean;
  };
  unreadCount?: number;
}

export default function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { refreshUnreadCount } = useUnreadMessages();

  const refreshConversations = useCallback(async () => {
    if (!auth.currentUser) return;
    setRefreshing(true);
    try {
      // Get fresh data immediately instead of clearing and waiting for listeners
      const initiatorSnapshot = await getDocs(query(
        collection(db, 'conversations'),
        where('initiator_id', '==', auth.currentUser.uid),
        orderBy('updated_at', 'desc'),
        limit(50)
      ));
      
      const receiverSnapshot = await getDocs(query(
        collection(db, 'conversations'),
        where('receiver_id', '==', auth.currentUser.uid),
        orderBy('updated_at', 'desc'),
        limit(50)
      ));

      const initiatorConvs = initiatorSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isInitiator: true
      }));

      const receiverConvs = receiverSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isInitiator: false
      }));

      // Update both sets of conversations
      await Promise.all([
        updateConversations(initiatorConvs, true),
        updateConversations(receiverConvs, false)
      ]);
      
      // Refresh unread message count
      await refreshUnreadCount();
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      setError('Failed to refresh conversations');
    } finally {
      setRefreshing(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);

    // Create queries for conversations where user is either initiator or receiver
    const initiatorQuery = query(
      collection(db, 'conversations'),
      where('initiator_id', '==', auth.currentUser.uid),
      orderBy('updated_at', 'desc'),
      limit(50)
    );

    const receiverQuery = query(
      collection(db, 'conversations'),
      where('receiver_id', '==', auth.currentUser.uid),
      orderBy('updated_at', 'desc'),
      limit(50)
    );

    // Subscribe to both queries
    const unsubscribeInitiator = onSnapshot(initiatorQuery, async (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isInitiator: true
      }));
      await updateConversations(convs, true);
      // Refresh unread message count when conversations change
      await refreshUnreadCount();
    }, error => {
      console.error('Error in initiator subscription:', error);
      setError('Failed to load conversations');
      setLoading(false);
    });

    const unsubscribeReceiver = onSnapshot(receiverQuery, async (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isInitiator: false
      }));
      await updateConversations(convs, false);
      // Refresh unread message count when conversations change
      await refreshUnreadCount();
    }, error => {
      console.error('Error in receiver subscription:', error);
      setError('Failed to load conversations');
      setLoading(false);
    });

    // Refresh unread message count when component mounts
    refreshUnreadCount();

    return () => {
      unsubscribeInitiator();
      unsubscribeReceiver();
    };
  }, [refreshUnreadCount]);

  const updateConversations = async (newConvs: any[], isInitiator: boolean) => {
    try {
      // Fetch profiles for all conversations
      const conversationsWithProfiles = await Promise.all(
        newConvs.map(async (conv) => {
          // Determine which ID is the other user's
          const otherUserId = isInitiator ? conv.receiver_id : conv.initiator_id;
          
          try {
            // Get the other user's profile
            const userDoc = await getDoc(doc(db, 'profiles', otherUserId));
            const userData = userDoc.data();
            
            return {
              ...conv,
              otherUser: {
                display_name: userData?.display_name || 'Deleted User',
                photo_url: userData?.photo_url,
                deleted: !userDoc.exists()
              }
            };
          } catch (error) {
            console.error(`Error fetching profile for user ${otherUserId}:`, error);
            return {
              ...conv,
              otherUser: {
                display_name: 'Deleted User',
                deleted: true
              }
            };
          }
        })
      );

      // Get unread message counts for each conversation
      const enhancedConvs = await Promise.all(conversationsWithProfiles.map(async (conv) => {
        try {
          // Check for unread messages in this conversation
          const messagesRef = collection(db, 'conversations', conv.id, 'messages');
          const messagesSnap = await getDocs(messagesRef);
          
          // Count unread messages not sent by current user
          let unreadCount = 0;
          messagesSnap.forEach(messageDoc => {
            const messageData = messageDoc.data();
            if (!messageData.read && messageData.sender_id !== auth.currentUser?.uid) {
              unreadCount++;
            }
          });
          
          return { ...conv, unreadCount };
        } catch (error) {
          console.error('Error getting unread counts:', error);
          return { ...conv, unreadCount: 0 };
        }
      }));

      setConversations(current => {
        // Filter out conversations that match the new ones' IDs
        const filtered = current.filter(conv => 
          !enhancedConvs.find(newConv => newConv.id === conv.id)
        );
        
        // Combine and sort by updated_at time
        const combined = [...filtered, ...enhancedConvs].sort((a, b) => {
          const timeA = a.updated_at || a.last_message_time;
          const timeB = b.updated_at || b.last_message_time;
          return new Date(timeB).getTime() - new Date(timeA).getTime();
        });
        return combined;
      });
    } catch (error) {
      console.error('Error updating conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationPress = (conversation: Conversation) => {
    router.push(`/chat/${conversation.id}`);
    // Refresh unread count when navigating to a conversation
    if (conversation.unreadCount && conversation.unreadCount > 0) {
      refreshUnreadCount();
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    // Check for both status and accepted fields for compatibility
    const isPending = (item.accepted === false || item.accepted === undefined) && 
                      (item.status === 'pending' || item.status === undefined);
    const isAccepted = item.accepted === true || item.status === 'accepted';
    const isReceived = !item.isInitiator;
    const otherUser = item.otherUser || {
      display_name: 'Unknown User',
      photo_url: undefined,
      deleted: false
    };
    const isDeletedUser = otherUser.deleted || false;
    const hasUnread = item.unreadCount && item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item)}
        disabled={isDeletedUser && !isPending}
      >
        <View style={styles.avatarContainer}>
          {otherUser.photo_url ? (
            <Image source={{ uri: otherUser.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[
              styles.avatar, 
              styles.avatarPlaceholder,
              isDeletedUser ? styles.deletedUserAvatar : null
            ]}>
              <Text style={[
                styles.avatarText,
                isDeletedUser ? styles.deletedUserText : null
              ]}>
                {otherUser.display_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {isPending && isReceived && <View style={styles.notificationDot} />}
          {hasUnread && <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
          </View>}
        </View>

        <View style={styles.conversationDetails}>
          <View style={styles.nameRow}>
            <Text style={[
              styles.name,
              isDeletedUser ? styles.deletedUserName : null,
              hasUnread ? styles.unreadName : null
            ]} numberOfLines={1}>
              {otherUser.display_name}
            </Text>
            <Text style={styles.time}>
              {item.updated_at ? formatTime(item.updated_at) : ''}
            </Text>
          </View>

          <View style={styles.messageRow}>
            {isPending ? (
              <Text style={[
                styles.status,
                isDeletedUser ? styles.deletedUserStatus : (isReceived ? styles.pendingReceived : styles.pendingSent)
              ]}>
                {isReceived ? 'Chat Request Received' : 'Chat Request Sent'}
              </Text>
            ) : (
              <Text style={[
                styles.lastMessage,
                isDeletedUser ? styles.deletedUserMessage : null,
                hasUnread ? styles.unreadMessage : null
              ]} numberOfLines={1}>
                {isDeletedUser ? 'User no longer available' : (item.last_message || 'No messages yet')}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
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
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setError(null)}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>
      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          conversations.length === 0 && styles.emptyListContent
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshConversations}
            tintColor={colors.primary}
            colors={[colors.primary]}
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
    </SafeAreaView>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'white',
    minHeight: 64,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: colors.lightGray,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    color: colors.darkGray,
    fontWeight: '500',
  },
  notificationDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.warning,
    borderWidth: 2,
    borderColor: 'white',
  },
  conversationDetails: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 4,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 14,
    color: colors.darkGray,
    marginTop: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 15,
    color: colors.darkGray,
    flex: 1,
  },
  status: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  pendingReceived: {
    color: colors.warning,
    fontWeight: '500',
  },
  pendingSent: {
    color: colors.darkGray,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
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
  deletedUserAvatar: {
    backgroundColor: colors.lightGray,
  },
  deletedUserText: {
    color: colors.mediumGray,
  },
  deletedUserName: {
    color: colors.mediumGray,
    fontStyle: 'italic',
  },
  deletedUserMessage: {
    color: colors.mediumGray,
    fontStyle: 'italic',
  },
  deletedUserStatus: {
    color: colors.mediumGray,
    fontStyle: 'italic',
  },
  unreadBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.background,
  },
  unreadBadgeText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  unreadName: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  unreadMessage: {
    fontWeight: 'bold',
    color: colors.text,
  },
});