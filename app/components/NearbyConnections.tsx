import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import * as NearbyConnections from 'expo-nearby-connections';
import { Strategy } from 'expo-nearby-connections';

interface Peer {
  peerId: string;
  name: string;
}

interface Message {
  peerId: string;
  text: string;
}

export default function NearbyConnectionsComponent() {
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [discoveredPeers, setDiscoveredPeers] = useState<Peer[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Start advertising
  const startAdvertising = async () => {
    try {
      setIsAdvertising(true);
      const peerId = await NearbyConnections.startAdvertise(
        `User-${Math.random().toString(36).substr(2, 9)}`,
        Strategy.P2P_STAR
      );
      setMyPeerId(peerId);
    } catch (error) {
      console.error('Error starting advertising:', error);
    }
  };

  // Start discovering
  const startDiscovering = async () => {
    try {
      setIsDiscovering(true);
      const peerId = await NearbyConnections.startDiscovery(
        `User-${Math.random().toString(36).substr(2, 9)}`,
        Strategy.P2P_STAR
      );
      setMyPeerId(peerId);
    } catch (error) {
      console.error('Error starting discovery:', error);
    }
  };

  // Stop advertising
  const stopAdvertising = async () => {
    try {
      await NearbyConnections.stopAdvertise();
      setIsAdvertising(false);
    } catch (error) {
      console.error('Error stopping advertising:', error);
    }
  };

  // Stop discovering
  const stopDiscovering = async () => {
    try {
      await NearbyConnections.stopDiscovery();
      setIsDiscovering(false);
    } catch (error) {
      console.error('Error stopping discovery:', error);
    }
  };

  // Request connection
  const requestConnection = async (peerId: string) => {
    try {
      await NearbyConnections.requestConnection(peerId);
    } catch (error) {
      console.error('Error requesting connection:', error);
    }
  };

  // Accept connection
  const acceptConnection = async (peerId: string) => {
    try {
      await NearbyConnections.acceptConnection(peerId);
    } catch (error) {
      console.error('Error accepting connection:', error);
    }
  };

  // Send message
  const sendMessage = async (peerId: string, text: string) => {
    try {
      await NearbyConnections.sendText(peerId, text);
      setMessages(prev => [...prev, { peerId, text }]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Set up event listeners
  useEffect(() => {
    const onInvitationListener = NearbyConnections.onInvitationReceived(({ peerId, name }) => {
      // Auto-accept connections for demo purposes
      acceptConnection(peerId);
    });

    const onConnectedListener = NearbyConnections.onConnected(({ peerId, name }) => {
      setConnectedPeers(prev => [...prev, { peerId, name }]);
    });

    const onDisconnectedListener = NearbyConnections.onDisconnected(({ peerId }) => {
      setConnectedPeers(prev => prev.filter(peer => peer.peerId !== peerId));
    });

    const onPeerFoundListener = NearbyConnections.onPeerFound(({ peerId, name }) => {
      setDiscoveredPeers(prev => [...prev, { peerId, name }]);
    });

    const onPeerLostListener = NearbyConnections.onPeerLost(({ peerId }) => {
      setDiscoveredPeers(prev => prev.filter(peer => peer.peerId !== peerId));
    });

    const onTextReceivedListener = NearbyConnections.onTextReceived(({ peerId, text }) => {
      setMessages(prev => [...prev, { peerId, text }]);
    });

    return () => {
      onInvitationListener();
      onConnectedListener();
      onDisconnectedListener();
      onPeerFoundListener();
      onPeerLostListener();
      onTextReceivedListener();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isAdvertising && styles.activeButton]}
          onPress={isAdvertising ? stopAdvertising : startAdvertising}>
          <Text style={styles.buttonText}>
            {isAdvertising ? 'Stop Advertising' : 'Start Advertising'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isDiscovering && styles.activeButton]}
          onPress={isDiscovering ? stopDiscovering : startDiscovering}>
          <Text style={styles.buttonText}>
            {isDiscovering ? 'Stop Discovering' : 'Start Discovering'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discovered Peers</Text>
        <FlatList
          data={discoveredPeers}
          keyExtractor={item => item.peerId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.peerItem}
              onPress={() => requestConnection(item.peerId)}>
              <Text style={styles.peerText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connected Peers</Text>
        <FlatList
          data={connectedPeers}
          keyExtractor={item => item.peerId}
          renderItem={({ item }) => (
            <View style={styles.peerItem}>
              <Text style={styles.peerText}>{item.name}</Text>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => sendMessage(item.peerId, 'Hello!')}>
                <Text style={styles.messageButtonText}>Send Message</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Messages</Text>
        <FlatList
          data={messages}
          keyExtractor={(item, index) => `${item.peerId}-${index}`}
          renderItem={({ item }) => (
            <View style={styles.messageItem}>
              <Text style={styles.messageText}>{item.text}</Text>
              <Text style={styles.messagePeerId}>From: {item.peerId}</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  peerItem: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  peerText: {
    color: '#fff',
    fontSize: 16,
  },
  messageButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 4,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  messageItem: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  messagePeerId: {
    color: '#888',
    fontSize: 12,
  },
}); 