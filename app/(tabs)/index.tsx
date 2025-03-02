import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, SafeAreaView, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Radar from '../../src/components/Radar';
import { useRadarUsers } from '../../src/hooks/useRadarUsers';
import { startConversation } from '../../src/lib/firebase';
import colors from '../../src/theme/colors';

// Maximum distance for radar in meters
const MAX_RADAR_DISTANCE = 100; 

export default function NearbyScreen() {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showingUserInfo, setShowingUserInfo] = useState(false);
  const [viewingFullProfile, setViewingFullProfile] = useState(false);
  const { users, location, loading, error, currentUser } = useRadarUsers(MAX_RADAR_DISTANCE);

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
    
    try {
      await startConversation(selectedUser.id, 'Hey, I noticed you nearby. Would you like to chat?');
      router.push('/chats');
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
    
    setSelectedUser(null);
    setShowingUserInfo(false);
    setViewingFullProfile(false);
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

  const renderProfileStat = (label: string, value: string | number) => (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding people nearby...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color={colors.error} />
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.tryAgainButton}>
          <Text style={styles.tryAgainText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>People Nearby</Text>
        <Text style={styles.subtitle}>
          {users.length > 0 
            ? `${users.length} people within ${MAX_RADAR_DISTANCE}m`
            : 'No one nearby yet. Stay active!'}
        </Text>
      </View>
      
      <View style={styles.radarContainer}>
        {users.length > 0 && currentUser ? (
          <Radar
            users={users}
            currentUser={{
              id: currentUser.uid,
              photo_url: currentUser.photoURL || undefined
            }}
            maxDistance={MAX_RADAR_DISTANCE}
            onUserPress={handleUserPress}
          />
        ) : (
          <View style={styles.emptyRadar}>
            <Ionicons name="people" size={60} color={colors.mediumGray} />
            <Text style={styles.emptyRadarText}>Keep the app open to discover people nearby</Text>
          </View>
        )}
      </View>

      {/* User Info Modal */}
      <Modal
        visible={showingUserInfo}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseProfile}
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

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.startChatButton}
                  onPress={handleStartChat}
                >
                  <Ionicons name="chatbubble" size={20} color={colors.background} />
                  <Text style={styles.startChatText}>Send Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    minHeight: '60%',
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
    padding: 20,
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
    marginTop: 10,
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
});