import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, SafeAreaView, Image, RefreshControl, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView as RNScrollView, BackHandler, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Radar from '../../src/components/Radar';
import { useNearbyUsers } from '../../src/hooks/useNearbyUsers';
import { startConversation, getCurrentUser } from '../../src/lib/firebase';
import colors from '../../src/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BleService from '../../src/services/BleService';
import VerifiedBadge from '../../src/components/VerifiedBadge';

// Maximum distance for radar in meters
const MAX_RADAR_DISTANCE = 10;

export default function NearbyScreen() {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showingUserInfo, setShowingUserInfo] = useState(false);
  const [viewingFullProfile, setViewingFullProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false);
  const { users, loading, error, isScanning, btEnabled, isAuthorized, refreshUsers, startScanning, stopScanning, setUsers } = useNearbyUsers();

  // Define handleCloseProfile first since it's used in the useEffect below
  const handleCloseProfile = useCallback(() => {
    if (viewingFullProfile) {
      setViewingFullProfile(false);
    } else {
      // Close modal with slight delay to prevent UI freezing
      // This helps with animation completion
      requestAnimationFrame(() => {
        setShowingUserInfo(false);
        // Wait for modal close animation to complete before updating other state
        setTimeout(() => {
          setSelectedUser(null);
        }, 100);
      });
    }
  }, [viewingFullProfile]);

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

  // Add this useEffect for handling hardware back button
  useEffect(() => {
    // Only run on Android
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (showingUserInfo) {
          // If modal is open, handle back button press
          handleCloseProfile();
          // Return true to prevent default back button behavior
          return true;
        }
        // Return false to allow default back button behavior
        return false;
      });

      return () => backHandler.remove();
    }
  }, [showingUserInfo, handleCloseProfile]);

  const handleUserPress = useCallback((userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setShowingUserInfo(true);
      setViewingFullProfile(false);
    }
  }, [users]);

  const handleStartChat = useCallback(async () => {
    if (!selectedUser) return;
    
    try {
      // Start conversation with the wave emoji as the initial message
      const result = await startConversation(selectedUser.id, "👋");
      
      // Close the modal safely using requestAnimationFrame
      requestAnimationFrame(() => {
        setShowingUserInfo(false);
        // Only navigate after modal is closed
        setTimeout(() => {
          setSelectedUser(null);
          
          // If we get a conversationId back, navigate to that chat
          if (result?.conversationId) {
            router.push(`/chat/${result.conversationId}`);
          } else {
            // Otherwise go to chats list
            router.push('/chats');
          }
        }, 100);
      });
      
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      if (error.message?.includes('already have a pending conversation')) {
        Alert.alert(
          'Pending Request',
          'You already have a pending conversation request with this user.',
          [
            { text: 'Stay Here', style: 'cancel' },
            { text: 'Go to Chats', onPress: () => router.push('/chats') }
          ]
        );
      } else if (error.message?.includes('declined your previous conversation')) {
        Alert.alert('Request Declined', error.message);
      } else {
        Alert.alert('Error', 'Failed to start conversation. Please try again.');
      }
    }
  }, [selectedUser]);
  
  const handleSendMessage = async (userId: string, message: string) => {
    try {
      // Use wave emoji if no custom message provided
      const messageToSend = message.trim() === "" ? "👋" : message;
      
      const result = await startConversation(userId, messageToSend);
      
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
          [
            { text: 'Stay Here', style: 'cancel' },
            { text: 'Go to Chats', onPress: () => router.push('/chats') }
          ]
        );
      }
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      if (error.message?.includes('already have a pending conversation')) {
        Alert.alert(
          'Pending Request',
          'You already have a pending conversation request with this user.',
          [
            { text: 'Stay Here', style: 'cancel' },
            { text: 'Go to Chats', onPress: () => router.push('/chats') }
          ]
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Just perform a standard refresh but don't reset UI state
      await refreshUsers();
    } catch (error) {
      console.error('Error refreshing nearby users:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUsers]);

  // Add a useEffect to update the selectedUser data when users list changes
  useEffect(() => {
    // Update the selected user data if it's in the list
    if (selectedUser?.id && users.length > 0) {
      const updatedUser = users.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        // Update the selected user without closing the modal
        setSelectedUser(updatedUser);
      }
    }
  }, [users]);

  const renderProfileStat = (label: string, value: string | number) => (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );

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
      <StatusBar style="dark" />
      
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
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Nearby</Text>
          <TouchableOpacity 
            style={styles.visibilityIndicator}
            onPress={() => {
              Alert.alert(
                isAuthorized ? "You are Visible" : "You are Invisible",
                Platform.OS === 'ios'
                  ? (isAuthorized 
                    ? "Other users can see you on their radar. To go invisible, disable Bluetooth permissions for the app in your device settings."
                    : "You are currently invisible to other users. To become visible, enable Bluetooth permissions for ShyText in your device settings.")
                  : (isAuthorized
                    ? "Other users can see you on their radar. To go invisible, toggle off Bluetooth in your device settings."
                    : "You are currently invisible to other users. To become visible, turn on Bluetooth in your device settings."),
                [
                  { text: "Cancel", style: "cancel" },
                  { 
                    text: "Open Settings", 
                    onPress: () => {
                      try {
                        if (Platform.OS === 'ios') {
                          Linking.openURL('app-settings:');
                        } else {
                          Linking.openSettings();
                        }
                      } catch (error) {
                        console.error('Error opening settings:', error);
                        Alert.alert('Error', 'Unable to open settings. Please open your device settings manually.');
                      }
                    }
                  }
                ]
              )
            }}
          >
            <View style={[styles.statusDot, { backgroundColor: isAuthorized ? colors.success : colors.error }]} />
            <Text style={styles.visibilityText}>{isAuthorized ? "Visible" : "Invisible"}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.radarContainer}>
          {!isAuthorized && !loading && (
            <View style={styles.noUsersContainer}>
              <Text style={styles.noUsersText}>
                {Platform.OS === 'ios'
                  ? "Bluetooth permissions are required to discover nearby users."
                  : "Bluetooth is disabled. Please enable Bluetooth to discover nearby users."}
              </Text>
              <Text style={styles.subText}>
                {Platform.OS === 'ios'
                  ? "Enable Bluetooth permissions in Settings and pull down to refresh"
                  : "Enable Bluetooth and pull down to refresh"}
              </Text>
            </View>
          )}

          {isAuthorized && loading && (
            <View style={styles.noUsersContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.noUsersText}>Initializing Bluetooth...</Text>
            </View>
          )}

          {isAuthorized && !loading && users.length === 0 && (
            <View style={styles.noUsersContainer}>
              <Text style={styles.noUsersText}>
                {isScanning ? 'Scanning for nearby devices...' : 'No users found nearby'}
              </Text>
              <Text style={styles.subText}>
                Pull down to refresh
              </Text>
            </View>
          )}

          {isAuthorized && !loading && users.length > 0 && (
            <>
              <Radar
                users={users}
                currentUser={{
                  id: getCurrentUser()?.uid || '',
                  photo_url: getCurrentUser()?.photoURL || '',
                  display_name: getCurrentUser()?.displayName || ''
                }}
                maxDistance={MAX_RADAR_DISTANCE}
                onUserPress={handleUserPress}
              />
            </>
          )}
        </View>
      </RNScrollView>

      {/* User Info Modal */}
      <Modal
        visible={showingUserInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseProfile}
        statusBarTranslucent={true}
        hardwareAccelerated={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Close Button */}
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={handleCloseProfile}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Verification Badge - Added to top left */}
            <View style={styles.verificationBadgeContainer}>
              <VerifiedBadge isVerified={true} size="large" />
            </View>
            
            {/* Also log the user data to check if is_verified exists */}
            {selectedUser && console.log('Selected user data:', JSON.stringify(selectedUser))}

            {/* Profile Content */}
            <View style={styles.profileContentCompact}>
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

              {/* Action Button */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.startChatButton}
                  onPress={handleStartChat}
                >
                  <Ionicons name="chatbubble" size={20} color={colors.background} />
                  <Text style={styles.startChatText}>
                    Start Conversation
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  visibilityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  visibilityText: {
    fontSize: 14,
    color: colors.text,
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    padding: 0,
  },
  modalHeader: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
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
    width: '100%',
    padding: 0,
  },
  profileImage: {
    width: '100%', 
    height: undefined,
    aspectRatio: 1,
    resizeMode: 'cover',
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
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
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
    justifyContent: 'center',
    paddingBottom: 0,
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
  subText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.darkGray,
  },
  startChatButtonDisabled: {
    backgroundColor: 'rgba(128, 128, 128, 0.6)',
  },
  profileContentSimple: {
    flex: 1,
  },
  profileContentCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContentCompact: {
    display: 'flex',
    flexDirection: 'column',
  },
  verificationBadgeContainer: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 6,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
});