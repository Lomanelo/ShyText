import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Image, Modal, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import colors from '../../src/theme/colors';
import { auth, getCurrentUser, getProfile, uploadProfileImage } from '../../src/lib/firebase';
import { signOut, getAuth } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { sendLocalNotification } from '../../src/utils/notifications';
import { useAuth } from '../../src/hooks/useAuth';
import VerifiedBadge from '../../src/components/VerifiedBadge';

export default function SettingsScreen() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);
  const [modalAnimationComplete, setModalAnimationComplete] = useState(true);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const fetchUserProfile = async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      try {
        const profile = await getProfile(currentUser.uid);
        if (profile) {
          // Calculate age from birth_date if available
          let age = null;
          let formattedBirthDate = 'Not available';
          
          if (profile.birth_date) {
            try {
              const birthDate = new Date(profile.birth_date);
              // Make sure we have a valid date before calculating age
              if (!isNaN(birthDate.getTime())) {
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                  age--;
                }
                
                // Format date for display (e.g., "January 1, 1990")
                formattedBirthDate = birthDate.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              }
            } catch (error) {
              console.error('Error parsing birth date:', error);
              formattedBirthDate = 'Invalid date format';
            }
          }
          
          // Prefer the auth profile photoURL because it's always the most current
          const photoUrl = authUser?.photoURL || profile.photo_url;
          
          setUser({
            ...profile,
            photo_url: photoUrl,
            age,
            formattedBirthDate
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    let mounted = true;
    
    const loadUserProfile = async () => {
      if (mounted) {
        await fetchUserProfile();
      }
    };
    
    loadUserProfile();
    
    // Clean up function
    return () => {
      mounted = false;
      // Ensure all modals are closed when component unmounts
      setShowProfileDetails(false);
      setShowProfileImageModal(false);
    };
  }, [authUser]); // Refetch when authUser changes
  
  const onRefresh = async () => {
    setRefreshing(true);
    // Force refresh the auth object to get the latest photoURL
    const auth = getAuth();
    await auth.currentUser?.reload();
    fetchUserProfile();
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              await signOut(auth);
              // Navigate back to the welcome screen
              router.replace('/(auth)');
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const handleProfilePress = () => {
    if (isActionInProgress || !modalAnimationComplete) return;
    
    setIsActionInProgress(true);
    setModalAnimationComplete(false);
    setShowProfileDetails(true);
    
    // Reset action lock after a short delay
    setTimeout(() => {
      setIsActionInProgress(false);
    }, 800);
  };

  const handleCloseProfileModal = () => {
    if (isActionInProgress || !modalAnimationComplete) return;
    
    setIsActionInProgress(true);
    setShowProfileDetails(false);
    
    // Reset action lock after animation completes
    setTimeout(() => {
      setIsActionInProgress(false);
    }, 400);
  };

  const handleProfileImagePress = () => {
    if (isActionInProgress) return;
    
    if (user?.photo_url || authUser?.photoURL) {
      setIsActionInProgress(true);
      setShowProfileImageModal(true);
      
      // Reset action lock after a short delay
      setTimeout(() => {
        setIsActionInProgress(false);
      }, 500);
    }
  };

  const handleCloseImageModal = () => {
    if (isActionInProgress) return;
    
    setIsActionInProgress(true);
    setShowProfileImageModal(false);
    
    // Reset action lock after animation completes
    setTimeout(() => {
      setIsActionInProgress(false);
    }, 300);
  };

  const handleChangeProfileImage = async () => {
    if (isActionInProgress || uploadingImage) return;
    
    setIsActionInProgress(true);
    
    try {
      // Request permission if needed
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to change your profile picture.');
          return;
        }
      }

      // Show options to take photo or choose from gallery
      Alert.alert(
        'Change Profile Picture',
        'Choose an option',
        [
          {
            text: 'Take Photo',
            onPress: takePicture,
          },
          {
            text: 'Choose from Gallery',
            onPress: pickImage,
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsActionInProgress(false),
          },
        ],
        { 
          cancelable: true,
          onDismiss: () => setIsActionInProgress(false)
        }
      );
    } catch (error) {
      console.error('Error preparing image picker:', error);
      setIsActionInProgress(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadProfilePicture(result.assets[0].uri);
      } else {
        // User canceled the picker
        setIsActionInProgress(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setIsActionInProgress(false);
    }
  };

  const takePicture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera permissions to take a picture!');
        setIsActionInProgress(false);
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadProfilePicture(result.assets[0].uri);
      } else {
        // User canceled taking picture
        setIsActionInProgress(false);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
      setIsActionInProgress(false);
    }
  };

  const uploadProfilePicture = async (imageUri: string) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to update your profile picture.');
      setIsActionInProgress(false);
      return;
    }

    try {
      setUploadingImage(true);
      setUploadError(null);

      // Upload the image
      const result = await uploadProfileImage(imageUri, currentUser.uid);
      
      if (result.success) {
        // Refresh the user profile to get the updated image URL
        await fetchUserProfile();
        Alert.alert('Success', 'Your profile picture has been updated.');
        
        // Close profile details modal after successful upload
        setShowProfileDetails(false);
      } else {
        setUploadError(result.error?.toString() || 'Failed to upload image');
        if (result.error?.toString().includes('too large')) {
          Alert.alert('Error', 'The image is too large. Please choose a smaller image or reduce the quality.');
        } else {
          Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setUploadingImage(false);
      setIsActionInProgress(false);
    }
  };

  // Wrap image component in memo to prevent unnecessary re-renders
  const ProfileImage = React.memo(({ photoUrl, displayName }: { photoUrl?: string, displayName?: string }) => {
    return photoUrl ? (
      <Image
        source={{ uri: photoUrl }}
        style={styles.profileImage}
        onError={() => console.log('Failed to load profile image')}
      />
    ) : (
      <View style={styles.profileImagePlaceholder}>
        <Text style={styles.profileInitial}>
          {displayName ? displayName.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>
    );
  });

  return (
    <ScrollView 
      style={styles.container}
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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Profile Section */}
      <TouchableOpacity 
        style={styles.profileSection} 
        onPress={handleProfilePress}
        activeOpacity={0.7}
        disabled={isActionInProgress || !modalAnimationComplete}
      >
        <TouchableOpacity 
          style={styles.profileImageContainer}
          onPress={handleProfileImagePress}
        >
          <ProfileImage 
            photoUrl={user?.photo_url || authUser?.photoURL} 
            displayName={user?.display_name} 
          />
          
          <TouchableOpacity 
            style={styles.editProfileImageButton}
            onPress={handleChangeProfileImage}
          >
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
        
        <View style={styles.profileInfo}>
          <View style={styles.profileNameContainer}>
            <Text style={styles.profileName}>{user?.display_name || authUser?.displayName || 'User'}</Text>
            <VerifiedBadge 
              isVerified={!!user?.is_verified} 
              size="small"
            />
          </View>
          {user?.age && <Text style={styles.profileAge}>{user.age} years old</Text>}
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
      </TouchableOpacity>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeader}>
          <Text style={styles.settingsSectionTitle}>Notifications</Text>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="notifications-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="person-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Account</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>About</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingsItem, styles.signOutButton]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={24} color={colors.error} />
          <Text style={[styles.settingsText, styles.signOutText]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Full Profile Modal */}
      <Modal
        visible={showProfileDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseProfileModal}
        onShow={() => {
          // Animation has completed showing
          setModalAnimationComplete(true);
        }}
        onDismiss={() => {
          // Clean up after modal is fully dismissed
          setModalAnimationComplete(true);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile</Text>
              <TouchableOpacity 
                onPress={handleCloseProfileModal}
                disabled={isActionInProgress || !modalAnimationComplete}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScrollContent}
              bounces={false}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
            >
              {/* Full Profile Image Card */}
              <View style={styles.fullProfileCard}>
                <TouchableOpacity 
                  style={styles.fullProfileImageContainer}
                  onPress={handleProfileImagePress}
                >
                  {(user?.photo_url || authUser?.photoURL) ? (
                    <Image
                      source={{ uri: user?.photo_url || authUser?.photoURL }}
                      style={styles.fullProfileImage}
                      resizeMode="cover"
                      progressiveRenderingEnabled={true}
                      fadeDuration={300}
                    />
                  ) : (
                    <View style={styles.fullProfileImagePlaceholder}>
                      <Ionicons name="person" size={80} color="#888888" />
                    </View>
                  )}
                </TouchableOpacity>
                
                <View style={styles.profileDetailsOverlay}>
                  <Text style={styles.fullProfileName}>
                    {user?.display_name || authUser?.displayName || 'User'}
                    {user?.age ? `, ${user.age}` : ''}
                  </Text>
                  <VerifiedBadge 
                    isVerified={!!user?.is_verified} 
                    size="medium"
                  />
                </View>
              </View>

              <Text style={styles.sectionTitle}>Profile Details</Text>
              <View style={styles.profileDetailItem}>
                <Ionicons name="calendar" size={24} color={colors.primary} style={styles.detailIcon} />
                <Text style={styles.detailLabel}>Birth Date:</Text>
                <Text style={styles.detailValue}>{user?.formattedBirthDate || 'Not available'}</Text>
              </View>

              <View style={styles.profileDetailItem}>
                <Ionicons 
                  name={user?.is_verified ? "shield-checkmark" : "shield-outline"} 
                  size={24} 
                  color={user?.is_verified ? colors.primary : colors.darkGray} 
                  style={styles.detailIcon} 
                />
                <Text style={styles.detailLabel}>Verification:</Text>
                <View style={styles.verificationStatus}>
                  <Text style={[
                    styles.detailValue, 
                    user?.is_verified ? styles.verifiedText : styles.notVerifiedText
                  ]}>
                    {user?.is_verified ? 'Verified' : 'Not Verified'}
                  </Text>
                  <VerifiedBadge 
                    isVerified={!!user?.is_verified} 
                    size="small"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </View>

              {user?.is_verified && user?.verified_at && (
                <View style={styles.profileDetailItem}>
                  <Ionicons name="time" size={24} color={colors.darkGray} style={styles.detailIcon} />
                  <Text style={styles.detailLabel}>Verified on:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(user.verified_at).toLocaleDateString()}
                  </Text>
                </View>
              )}

              <TouchableOpacity 
                style={styles.editProfileButton}
                onPress={handleChangeProfileImage}
                disabled={isActionInProgress || uploadingImage || !modalAnimationComplete}
                activeOpacity={0.7}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.editProfileButtonText}>Change Photo</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full screen profile image modal */}
      <Modal
        visible={showProfileImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseImageModal}
        statusBarTranslucent={true}
      >
        <View style={styles.fullScreenModalContainer}>
          <TouchableOpacity 
            style={styles.fullScreenCloseButton}
            onPress={handleCloseImageModal}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={1}
            style={{ width: '100%', height: '100%', justifyContent: 'center' }}
            onPress={handleCloseImageModal}
          >
            <Image 
              source={{ uri: user?.photo_url || authUser?.photoURL || '' }}
              style={styles.fullScreenImage}
              resizeMode="contain"
              progressiveRenderingEnabled={true}
              fadeDuration={300}
            />
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
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
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  profileImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginRight: 15,
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: colors.background,
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  profileAge: {
    fontSize: 14,
    color: colors.darkGray,
  },
  settingsSection: {
    marginTop: 20,
  },
  settingsSectionHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  settingsText: {
    color: colors.text,
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
  },
  signOutButton: {
    marginTop: 20,
    borderBottomWidth: 0,
  },
  signOutText: {
    color: colors.error,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  fullProfileCard: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
    backgroundColor: '#2A2A2A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fullProfileImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullProfileImage: {
    width: '100%',
    height: '100%',
  },
  fullProfileImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  profileDetailsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fullProfileName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 16,
  },
  profileDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  detailIcon: {
    marginRight: 10,
    width: 24,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.darkGray,
    width: 80,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  editProfileButton: {
    backgroundColor: colors.primary,
    borderRadius: 30,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  editProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '90%',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  editProfileImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  notVerifiedText: {
    color: colors.darkGray,
  },
});