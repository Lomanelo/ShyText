import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, SafeAreaView, Image, RefreshControl, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView as RNScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Radar from '../../src/components/Radar';
import { useNearbyUsers } from '../../src/hooks/useNearbyUsers';
import { startConversation, getCurrentUser } from '../../src/lib/firebase';
import colors from '../../src/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BleService from '../../src/services/BleService';

// Maximum distance for radar in meters
const MAX_RADAR_DISTANCE = 10;

export default function NearbyScreen() {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showingUserInfo, setShowingUserInfo] = useState(false);
  const [viewingFullProfile, setViewingFullProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false);
  const [customMessage, setCustomMessage] = useState('');
  const [showMessageInput, setShowMessageInput] = useState(false);
  const { users, loading, error, isScanning, btEnabled, refreshUsers, startScanning, stopScanning, setUsers } = useNearbyUsers();
  const [isDragging, setIsDragging] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setAuthError(true);
      // We let the TabLayout handle the redirect
    } else {
      // No longer need to check or store own device UUID
      console.log('User authenticated, focusing only on nearby devices');
    }
  }, []);

  // Start scanning when component is visible and Bluetooth is enabled
  useEffect(() => {
    if (btEnabled) {
      console.log('Bluetooth enabled, starting scanning...');
      startScanning();
    }

    // Cleanup
    return () => {
      if (isScanning) {
        console.log('Component unmounting, stopping scanning...');
        stopScanning();
      }
    };
  }, [btEnabled, startScanning, stopScanning, isScanning]);

  const handleUserPress = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setShowingUserInfo(true);
      setViewingFullProfile(false);
    }
  };

  const handleStartChat = async () => {
    if (!selectedUser) return;
    
    if (!showMessageInput) {
      setShowMessageInput(true);
      return;
    }
    
    if (!customMessage.trim()) {
      Alert.alert('Message Required', 'Please enter a message to start the conversation.');
      return;
    }
    
    try {
      const result = await startConversation(selectedUser.id, customMessage.trim());
      
      // If we get a conversationId back, it means there's an existing active conversation
      if (result?.conversationId) {
        Alert.alert(
          'Existing Conversation',
          'You already have an active conversation with this user.',
          [{ text: 'Go to Chat', onPress: () => router.push(`/chat/${result.conversationId}`) }]
        );
      } else {
        router.push('/chats');
      }
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      if (error.message?.includes('already have a pending conversation')) {
        Alert.alert(
          'Pending Request',
          'You already have a pending conversation request with this user.',
          [{ text: 'Go to Chats', onPress: () => router.push('/chats') }]
        );
      } else if (error.message?.includes('declined your previous conversation')) {
        Alert.alert('Request Declined', error.message);
      } else {
        Alert.alert('Error', 'Failed to start conversation. Please try again.');
      }
    }
    
    setSelectedUser(null);
    setShowingUserInfo(false);
    setViewingFullProfile(false);
    setShowMessageInput(false);
    setCustomMessage('');
  };
  
  const handleSendMessage = async (userId: string, message: string) => {
    try {
      const result = await startConversation(userId, message);
      
      // If we get a conversationId back, it means there's an existing active conversation
      if (result?.conversationId) {
        Alert.alert(
          'Existing Conversation',
          'You already have an active conversation with this user.',
          [{ text: 'Go to Chat', onPress: () => router.push(`/chat/${result.conversationId}`) }]
        );
      } else {
        Alert.alert(
          'Message Sent',
          'Your conversation request has been sent.',
          [{ text: 'OK', onPress: () => router.push('/chats') }]
        );
      }
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      if (error.message?.includes('already have a pending conversation')) {
        Alert.alert(
          'Pending Request',
          'You already have a pending conversation request with this user.',
          [{ text: 'Go to Chats', onPress: () => router.push('/chats') }]
        );
      } else if (error.message?.includes('declined your previous conversation')) {
        Alert.alert('Request Declined', error.message);
      } else {
        Alert.alert('Error', 'Failed to start conversation. Please try again.');
      }
    }
  };
  
  const handleViewProfile = () => {
    setViewingFullProfile(true);
  };
  
  const handleCloseProfile = () => {
    if (viewingFullProfile) {
      setViewingFullProfile(false);
    } else {
      setSelectedUser(null);
      setShowingUserInfo(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Show a confirmation dialog for a force refresh
      Alert.alert(
        'Refresh Options',
        'Choose refresh type:',
        [
          { 
            text: 'Standard Refresh', 
            onPress: async () => {
              try {
                await refreshUsers();
              } finally {
                setRefreshing(false);
              }
            }
          },
          { 
            text: 'Force Refresh (Clear All)', 
            style: 'destructive',
            onPress: async () => {
              try {
                // Stop scanning
                stopScanning();
                
                // Wait a moment for scanning to fully stop
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Clear the users array
                setUsers([]);
                
                // Reset BLE completely by restarting the scan system
                const bleService = BleService.getInstance();
                await bleService.cleanUp();
                
                // Wait a moment for cleanup to finish
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Start scanning again to completely reset the state
                await refreshUsers();
                
                console.log('Performed force refresh - all BLE caches cleared');
              } finally {
                setRefreshing(false);
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setRefreshing(false)
          }
        ]
      );
    } catch (error) {
      console.error('Error refreshing nearby users:', error);
      setRefreshing(false);
    }
  }, [refreshUsers, stopScanning, setUsers]);

  const renderProfileStat = (label: string, value: string | number) => (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );

  // Handler to be passed to Radar to set drag state
  const handleDragStateChange = (dragging: boolean) => {
    setIsDragging(dragging);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding people nearby...</Text>
      </View>
    );
  }

  if (authError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color={colors.error} />
        <Text style={styles.errorTitle}>Authentication Required</Text>
        <Text style={styles.errorText}>You need to be logged in to access this feature.</Text>
        <TouchableOpacity 
          style={styles.tryAgainButton} 
          onPress={() => router.replace('/(auth)')}>
          <Text style={styles.tryAgainText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color={colors.error} />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.tryAgainButton} 
          onPress={refreshUsers}>
          <Text style={styles.tryAgainText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <RNScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        scrollEnabled={!isDragging} // Disable scrolling during drag
      >
        <View style={styles.header}>
          {/* Activity indicator removed as requested */}
        </View>
        
        <View style={styles.radarContainer}>
          {!btEnabled && !loading && Platform.OS === 'android' && (
            <View style={styles.noUsersContainer}>
              <Text style={styles.noUsersText}>
                Bluetooth is disabled. Please enable Bluetooth to discover nearby users.
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => refreshUsers()}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!btEnabled && !loading && Platform.OS === 'ios' && (
            <View style={styles.noUsersContainer}>
              <Text style={styles.noUsersText}>
                Make sure Bluetooth is enabled in your iOS settings.
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => refreshUsers()}
              >
                <Text style={styles.retryButtonText}>Force Start Scanning</Text>
              </TouchableOpacity>
            </View>
          )}

          {btEnabled && loading && (
            <View style={styles.noUsersContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.noUsersText}>Initializing Bluetooth...</Text>
            </View>
          )}

          {btEnabled && !loading && users.length === 0 && (
            <View style={styles.noUsersContainer}>
              <Text style={styles.noUsersText}>
                {isScanning ? 'Scanning for nearby devices...' : 'No users found nearby'}
              </Text>
              <Text style={styles.debugText}>
                State: {isScanning ? 'Scanning' : 'Not scanning'} | Platform: {Platform.OS}
              </Text>
              {!isScanning ? (
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => startScanning()}
                >
                  <Text style={styles.retryButtonText}>Start Scanning</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.retryButton, { backgroundColor: colors.error }]}
                  onPress={() => {
                    stopScanning();
                    setTimeout(() => startScanning(), 1000);
                  }}
                >
                  <Text style={styles.retryButtonText}>Restart Scan</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {btEnabled && !loading && users.length > 0 && (
            <>
              <View style={styles.deviceInfoHeader}>
                <Text style={styles.deviceInfoHeaderText}>
                  Found {users.length} nearby device{users.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.deviceHeaderControls}>
                  <TouchableOpacity 
                    style={styles.iconButton}
                    onPress={() => {
                      Alert.alert(
                        'Device Information',
                        users.map(user => 
                          `${user.display_name}: ${user.distance}m, Last seen: ${new Date(user.lastActive || '').toLocaleTimeString()}`
                        ).join('\n\n'),
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="information-circle" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.iconButton}
                    onPress={onRefresh}
                  >
                    <Ionicons name="refresh" size={24} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <Radar
                users={users}
                currentUser={{
                  id: getCurrentUser()?.uid || '',
                  photo_url: getCurrentUser()?.photoURL || '',
                  display_name: getCurrentUser()?.displayName || ''
                }}
                maxDistance={MAX_RADAR_DISTANCE}
                onUserPress={handleUserPress}
                onMessageSend={handleSendMessage}
                onDragStateChange={handleDragStateChange}
              />
            </>
          )}
        </View>
      </RNScrollView>

      {/* User Info Modal */}
      <Modal
        visible={showingUserInfo}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseProfile}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity style={styles.closeButton} onPress={handleCloseProfile}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                
                {viewingFullProfile ? (
                  <Text style={styles.modalTitle}>Profile</Text>
                ) : (
                  <TouchableOpacity style={styles.viewProfileButton} onPress={handleViewProfile}>
                    <Text style={styles.viewProfileText}>View Full Profile</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Profile Content */}
              <RNScrollView 
                style={styles.scrollableContent}
                contentContainerStyle={styles.profileContentContainer}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.profileContent}>
                  {/* Profile Photo */}
                  <View style={styles.profileImageContainer}>
                    {selectedUser?.photo_url ? (
                      <Image
                        source={{ uri: selectedUser.photo_url }}
                        style={styles.profileImage}
                      />
                    ) : (
                      <View style={styles.profileImagePlaceholder}>
                        <Text style={styles.profileImagePlaceholderText}>
                          {selectedUser?.display_name?.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Basic Info */}
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>
                      {selectedUser?.display_name || 'Anonymous'}{' '}
                      {selectedUser?.birthdate && (
                        <Text style={styles.profileAge}>
                          {calculateAge(selectedUser.birthdate)}
                        </Text>
                      )}
                    </Text>
                    
                    <View style={styles.profileDistance}>
                      <Ionicons name="location" size={16} color={colors.primary} />
                      <Text style={styles.profileDistanceText}>
                        {selectedUser?.distance < 1000
                          ? `${Math.round(selectedUser?.distance)} meters away`
                          : `${(selectedUser?.distance / 1000).toFixed(1)} km away`}
                      </Text>
                    </View>
                    
                    {viewingFullProfile && selectedUser?.bio && (
                      <Text style={styles.profileBio}>{selectedUser.bio}</Text>
                    )}
                  </View>

                  {/* Message Input */}
                  {showMessageInput && (
                    <View style={styles.messageInputContainer}>
                      <Text style={styles.messageInputLabel}>Send a message to start the conversation:</Text>
                      <TextInput
                        style={styles.messageInput}
                        value={customMessage}
                        onChangeText={setCustomMessage}
                        placeholder="Write your message here..."
                        multiline
                        maxLength={500}
                        autoFocus
                      />
                    </View>
                  )}
                </View>
              </RNScrollView>

              {/* Action Buttons - Outside ScrollView to stay fixed at bottom */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.startChatButton}
                  onPress={handleStartChat}
                >
                  <Ionicons name={showMessageInput ? "send" : "chatbubble"} size={20} color={colors.background} />
                  <Text style={styles.startChatText}>
                    {showMessageInput ? "Send Message" : "Start Conversation"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const calculateAge = (birthDateString: string): number => {
  const today = new Date();
  const birthDate = new Date(birthDateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.darkGray,
  },
  radarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noUsersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noUsersText: {
    color: colors.darkGray,
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.darkGray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 10,
    marginBottom: 5,
  },
  errorText: {
    fontSize: 16,
    color: colors.darkGray,
    textAlign: 'center',
    marginBottom: 20,
  },
  tryAgainButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 25,
  },
  tryAgainText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    flex: 1,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  viewProfileButton: {
    padding: 5,
  },
  viewProfileText: {
    color: colors.primary,
    fontSize: 16,
  },
  profileContent: {
    flex: 1,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileImagePlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.background,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  profileAge: {
    fontSize: 22,
    color: colors.text,
  },
  profileDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileDistanceText: {
    fontSize: 14,
    color: colors.darkGray,
    marginLeft: 5,
  },
  profileBio: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  profileStat: {
    alignItems: 'center',
    marginHorizontal: 15,
  },
  profileStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  profileStatLabel: {
    fontSize: 12,
    color: colors.darkGray,
    marginTop: 5,
  },
  actionButtons: {
    paddingTop: 15,
    paddingBottom: Platform.OS === 'ios' ? 20 : 15,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
  },
  startChatButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
  },
  startChatText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  scrollableContent: {
    flex: 1,
  },
  profileContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  messageInputContainer: {
    marginTop: 20,
    width: '100%',
  },
  messageInputLabel: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    minHeight: 100,
    maxHeight: 150,
    textAlignVertical: 'top',
  },
  deviceInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  deviceInfoHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  deviceHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 5,
  },
  refreshButton: {
    padding: 5,
  },
  debugText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.darkGray,
  },
  retryButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});