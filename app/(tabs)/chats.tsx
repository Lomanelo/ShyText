import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { useConversations } from '../../src/hooks/useConversations';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { useState } from 'react';

export default function ChatsScreen() {
  const { conversations, loading, error } = useConversations();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // Function to navigate to chat detail
  const navigateToChat = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };
  
  // Function to get avatar source outside JSX
  const getAvatarSource = (user: any) => {
    const defaultImage = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop';
    return { uri: user?.photoURL || defaultImage };
  };

  // Function to handle avatar click
  const handleAvatarClick = (photoURL: string) => {
    setSelectedImage(photoURL);
    setImageModalVisible(true);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#f9f1e7', '#f9f1e7']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={['#f9f1e7', '#f9f1e7']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#f9f1e7', '#f9f1e7']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      
      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-outline" size={50} color="#999" style={styles.emptyIcon} />
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
              onPress={() => navigateToChat(item.id)}>
              <TouchableOpacity 
                onPress={() => {
                  const photoURL = item.otherUser?.photoURL;
                  if (photoURL) handleAvatarClick(photoURL);
                }}
                activeOpacity={item.otherUser?.photoURL ? 0.7 : 1}>
                <Image
                  source={getAvatarSource(item.otherUser)}
                  style={styles.avatar}
                />
              </TouchableOpacity>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{item.otherUser?.firstName || 'User'}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage || 'No messages yet'}
                </Text>
              </View>
              {item.unreadCount && item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContentContainer}
        />
      )}
      
      <ImagePreviewModal
        visible={imageModalVisible}
        imageUrl={selectedImage}
        onClose={() => setImageModalVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#222',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 8,
  },
  listContentContainer: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    color: '#666',
    fontSize: 14,
  },
  unreadBadge: {
    backgroundColor: '#222',
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