import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getDatabase, ref, push, onValue, query, orderByChild, get, set } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../src/lib/firebase';

type Message = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    
    const db = getDatabase();
    const messagesRef = ref(db, `messages/${id}`);
    
    // Initial fetch of messages
    fetchMessages();
    
    // Listen for new messages
    const messagesQuery = query(messagesRef, orderByChild('createdAt'));
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messagesList: Message[] = [];
        
        // Convert to array and add IDs
        Object.entries(messagesData).forEach(([key, value]) => {
          messagesList.push({
            id: key,
            ...value as any
          });
        });
        
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
      unsubscribe();
    };
  }, [id]);

  const fetchMessages = async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      const db = getDatabase();
      const messagesRef = ref(db, `messages/${id}`);
      const messagesQuery = query(messagesRef, orderByChild('createdAt'));
      
      const snapshot = await get(messagesQuery);
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messagesList: Message[] = [];
        
        // Convert to array and add IDs
        Object.entries(messagesData).forEach(([key, value]) => {
          messagesList.push({
            id: key,
            ...value as any
          });
        });
        
        // Sort by timestamp
        messagesList.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        setMessages(messagesList);
      }
      
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !id || typeof id !== 'string') return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be logged in');
      
      const db = getDatabase();
      const messagesRef = ref(db, `messages/${id}`);
      const newMessageRef = push(messagesRef);
      
      const messageData = {
        content: newMessage.trim(),
        senderId: currentUser.uid,
        createdAt: new Date().toISOString()
      };
      
      await set(newMessageRef, messageData);
      
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
            item.senderId === auth.currentUser?.uid ? 
              styles.sentMessage : 
              styles.receivedMessage
          ]}>
            <Text style={styles.messageText}>{item.content}</Text>
            <Text style={styles.messageTime}>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
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
  messagesList: {
    padding: 15,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0055FF',
    borderBottomRightRadius: 5,
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#2a2a2a',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
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
});