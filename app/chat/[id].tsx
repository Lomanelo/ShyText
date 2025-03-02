import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { auth, sendMessage, subscribeToMessages } from '../../src/lib/firebase';
import { Ionicons } from '@expo/vector-icons';

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();
    
    const unsubscribe = subscribeToMessages(id as string, (newMessages) => {
      setMessages(newMessages as Message[]);
      flatListRef.current?.scrollToEnd({ animated: true });
    });

    return () => {
      unsubscribe();
    };
  }, [id]);

  const fetchMessages = async () => {
    try {
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      await sendMessage(id as string, newMessage.trim());
      setNewMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading messages...</Text>
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.sender_id === auth.currentUser?.uid ? 
              styles.sentMessage : 
              styles.receivedMessage
          ]}>
            <Text style={styles.messageText}>{item.content}</Text>
            <Text style={styles.messageTime}>
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
  messagesList: {
    padding: 15,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 12,
    borderRadius: 16,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#2a2a2a',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  messageTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});