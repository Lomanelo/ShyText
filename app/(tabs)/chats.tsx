import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { useConversations } from '../../src/hooks/useConversations';
import { router } from 'expo-router';

export default function ChatsScreen() {
  const { conversations, loading, error } = useConversations();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading conversations...</Text>
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
    <View style={styles.container}>
      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No active conversations yet.{'\n'}
            Find someone nearby to start chatting!
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() => router.push(`/chat/${item.id}`)}>
              <Image
                source={{ 
                  uri: item.other_user.photo_url || 
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop' 
                }}
                style={styles.avatar}
              />
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{item.other_user.first_name}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.last_message?.content || 'No messages yet'}
                </Text>
              </View>
              {item.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    color: '#888',
    fontSize: 14,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});