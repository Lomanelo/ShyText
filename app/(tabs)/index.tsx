import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, SafeAreaView, Image, RefreshControl, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView as RNScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Radar from '../../src/components/Radar';
import { useRadarUsers } from '../../src/hooks/useRadarUsers';
import { startConversation, getCurrentUser } from '../../src/lib/firebase';
import colors from '../../src/theme/colors';
import LocationService from '../../src/services/LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define ActivityType here as a fallback in case the import fails
const FallbackActivityType = {
  STILL: 'still',
  WALKING: 'walking',
  RUNNING: 'running',
  VEHICLE: 'vehicle',
  UNKNOWN: 'unknown'
};

// Get ActivityType from LocationService if available
let ActivityType = FallbackActivityType;
try {
  // Try to access the ActivityType from the LocationService module
  const motionModule = require('../../src/services/MotionService');
  if (motionModule && motionModule.ActivityType) {
    ActivityType = motionModule.ActivityType;
  }
} catch (error) {
  console.warn('Failed to import ActivityType, using fallback:', error);
}

// Maximum distance for radar in meters
const MAX_RADAR_DISTANCE = 10;

export default function NearbyScreen() {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showingUserInfo, setShowingUserInfo] = useState(false);
  const [viewingFullProfile, setViewingFullProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false);
  const [motionData, setMotionData] = useState<{ 
    activity: string; 
    heading?: number;
    speed?: number;
    movementIntensity?: number;
  } | null>(null);
  const [showMotionData, setShowMotionData] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [showMessageInput, setShowMessageInput] = useState(false);
  const { users, location, loading, error, currentUser, refreshUsers } = useRadarUsers(MAX_RADAR_DISTANCE);
  const [isDragging, setIsDragging] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setAuthError(true);
      // We let the TabLayout handle the redirect
    }
  }, []);

  // Initialize the background location service
  useEffect(() => {
    const initBackgroundLocation = async () => {
      // Only initialize background tracking if user is logged in
      const user = getCurrentUser();
      if (!user) return;
      
      try {
        const success = await LocationService.startBackgroundTracking();
        if (success) {
          console.log('Background location tracking initialized successfully');
          
          // Set up a timer to periodically update motion data
          const intervalId = setInterval(() => {
            try {
              const data = LocationService.getLocationAndMotionData();
              if (data.motionData) {
                setMotionData({
                  activity: data.activity || ActivityType.UNKNOWN,
                  heading: data.motionData.heading,
                  speed: data.motionData.speed,
                  movementIntensity: data.motionData.movementIntensity
                });
              }
            } catch (error) {
              console.warn('Error updating motion data in interval:', error);
            }
          }, 2000); // Update every 2 seconds
          
          return () => clearInterval(intervalId);
        } else {
          console.warn('Failed to initialize background location tracking');
          // We'll show a banner only once to avoid annoying the user
          const hasShownPermissionAlert = await AsyncStorage.getItem('hasShownLocationPermissionAlert');
          if (!hasShownPermissionAlert) {
            Alert.alert(
              'Background Location',
              'To discover nearby users even when the app is closed, please allow ShyText to access your location "Always" in your device settings.',
              [
                { text: 'Later', style: 'cancel' },
                { 
                  text: 'Settings', 
                  onPress: () => {
                    // This would typically open settings
                    // For simplicity, we're just marking that we showed the alert
                    AsyncStorage.setItem('hasShownLocationPermissionAlert', 'true')
                      .catch(err => console.error('Error saving alert preference:', err));
                  }
                }
              ]
            );
          }
        }
      } catch (error) {
        console.error('Error initializing background location:', error);
      }
    };
    
    initBackgroundLocation();
    
    // Cleanup
    return () => {
      // Note: We're intentionally NOT stopping background tracking 
      // when component unmounts, as we want it to continue in the background
    };
  }, []);

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
      await startConversation(selectedUser.id, customMessage.trim());
      router.push('/chats');
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
    
    setSelectedUser(null);
    setShowingUserInfo(false);
    setViewingFullProfile(false);
    setShowMessageInput(false);
    setCustomMessage('');
  };
  
  const handleSendMessage = async (userId: string, message: string) => {
    try {
      await startConversation(userId, message);
      Alert.alert(
        'Message Sent',
        'Your conversation request has been sent.',
        [{ text: 'OK', onPress: () => router.push('/chats') }]
      );
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
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
      await refreshUsers();
    } catch (error) {
      console.error('Error refreshing nearby users:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUsers]);

  const renderProfileStat = (label: string, value: string | number) => (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );

  // Helper function to get a human-readable activity name
  const getActivityName = (activity: string) => {
    try {
      switch (activity) {
        case ActivityType.STILL: return 'Still';
        case ActivityType.WALKING: return 'Walking';
        case ActivityType.RUNNING: return 'Running';
        case ActivityType.VEHICLE: return 'In Vehicle';
        default: return 'Unknown';
      }
    } catch (error) {
      console.warn('Error getting activity name:', error);
      return 'Unknown';
    }
  };

  // Helper function to format heading as a direction
  const formatHeading = (heading?: number) => {
    try {
      if (heading === undefined) return 'Unknown';
      
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
      return directions[Math.round(heading / 45)];
    } catch (error) {
      console.warn('Error formatting heading:', error);
      return 'Unknown';
    }
  };

  // Helper function to format speed
  const formatSpeed = (speed?: number) => {
    try {
      if (speed === undefined) return 'Unknown';
      return `${(speed * 3.6).toFixed(1)} km/h`; // Convert to km/h and format
    } catch (error) {
      console.warn('Error formatting speed:', error);
      return 'Unknown';
    }
  };

  // Toggle motion data display
  const toggleMotionData = () => {
    setShowMotionData(!showMotionData);
  };

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
        scrollEnabled={!isDragging} // Disable scrolling during drag
      >
        <View style={styles.header}>
          <Text style={styles.title}>People Nearby</Text>
          <Text style={styles.subtitle}>
            {users.length > 0 
              ? `${users.length} people within ${MAX_RADAR_DISTANCE}m`
              : 'No one nearby yet. Stay active!'}
          </Text>
          
          {motionData && (
            <TouchableOpacity 
              style={styles.activityIndicator}
              onPress={toggleMotionData}
            >
              <Ionicons 
                name={
                  motionData.activity === ActivityType.STILL ? 'body' :
                  motionData.activity === ActivityType.WALKING ? 'walk' :
                  motionData.activity === ActivityType.RUNNING ? 'fitness' :
                  motionData.activity === ActivityType.VEHICLE ? 'car' : 'help-circle'
                } 
                size={18} 
                color={colors.primary} 
              />
              <Text style={styles.activityText}>
                {getActivityName(motionData.activity)}
              </Text>
              <Ionicons 
                name={showMotionData ? 'chevron-up' : 'chevron-down'} 
                size={16} 
                color={colors.darkGray} 
              />
            </TouchableOpacity>
          )}
          
          {showMotionData && motionData && (
            <View style={styles.motionDataContainer}>
              <View style={styles.motionDataItem}>
                <Ionicons name="compass" size={16} color={colors.darkGray} />
                <Text style={styles.motionDataText}>
                  Heading: {formatHeading(motionData.heading)}
                </Text>
              </View>
              
              <View style={styles.motionDataItem}>
                <Ionicons name="speedometer" size={16} color={colors.darkGray} />
                <Text style={styles.motionDataText}>
                  Speed: {formatSpeed(motionData.speed)}
                </Text>
              </View>
              
              <View style={styles.motionDataItem}>
                <Ionicons name="pulse" size={16} color={colors.darkGray} />
                <Text style={styles.motionDataText}>
                  Movement: {motionData.movementIntensity?.toFixed(2) || 'Unknown'}
                </Text>
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.radarContainer}>
          {users.length > 0 && currentUser ? (
            <Radar
              users={users}
              currentUser={{
                id: currentUser.id,
                photo_url: currentUser.photo_url,
                display_name: currentUser.display_name
              }}
              maxDistance={MAX_RADAR_DISTANCE}
              onUserPress={handleUserPress}
              onMessageSend={handleSendMessage}
              onDragStateChange={handleDragStateChange}
            />
          ) : (
            <View style={styles.emptyRadar}>
              <Ionicons name="people" size={60} color={colors.mediumGray} />
              <Text style={styles.emptyRadarText}>Keep the app open to discover people nearby</Text>
            </View>
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
  emptyRadar: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyRadarText: {
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
  activityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: 'center',
  },
  activityText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 6,
  },
  motionDataContainer: {
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    width: '100%',
  },
  motionDataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  motionDataText: {
    color: colors.text,
    fontSize: 14,
    marginLeft: 8,
  },
});