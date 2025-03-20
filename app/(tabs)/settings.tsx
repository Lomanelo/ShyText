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

export default function SettingsScreen() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);

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
    fetchUserProfile();
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
    setShowProfileDetails(true);
  };

  const handleProfileImagePress = () => {
    if (user?.photo_url || authUser?.photoURL) {
      setShowProfileImageModal(true);
    }
  };

  const handleChangeProfileImage = async () => {
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
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Error preparing image picker:', error);
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
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePicture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera permissions to take a picture!');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const uploadProfilePicture = async (imageUri: string) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to update your profile picture.');
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
    }
  };

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
      <TouchableOpacity style={styles.profileSection} onPress={handleProfilePress}>
        <TouchableOpacity 
          style={styles.profileImageContainer}
          onPress={handleProfileImagePress}
        >
          {(user?.photo_url || authUser?.photoURL) ? (
            <Image
              source={{ uri: user?.photo_url || authUser?.photoURL }}
              style={styles.profileImage}
              onError={() => console.log('Failed to load profile image')}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileInitial}>
                {user?.display_name ? user.display_name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.editProfileImageButton}
            onPress={handleChangeProfileImage}
          >
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
        
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.display_name || authUser?.displayName || 'User'}</Text>
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
        onRequestClose={() => setShowProfileDetails(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile</Text>
              <TouchableOpacity onPress={() => setShowProfileDetails(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

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
              </View>
            </View>

            <Text style={styles.sectionTitle}>Profile Details</Text>
            <View style={styles.profileDetailItem}>
              <Ionicons name="mail" size={24} color={colors.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{user?.email || 'No email available'}</Text>
            </View>

            <View style={styles.profileDetailItem}>
              <Ionicons name="calendar" size={24} color={colors.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>Birth Date:</Text>
              <Text style={styles.detailValue}>{user?.formattedBirthDate || 'Not available'}</Text>
            </View>

            <View style={styles.profileDetailItem}>
              <Ionicons name="time" size={24} color={colors.primary} style={styles.detailIcon} />
              <Text style={styles.detailLabel}>Member Since:</Text>
              <Text style={styles.detailValue}>
                {user?.created_at 
                  ? new Date(user.created_at).toLocaleDateString() 
                  : 'Not available'}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={() => {
                setShowProfileDetails(false);
                // Add functionality to navigate to edit profile screen
              }}
            >
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full screen profile image modal */}
      <Modal
        visible={showProfileImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileImageModal(false)}
      >
        <View style={styles.fullScreenModalContainer}>
          <TouchableOpacity 
            style={styles.fullScreenCloseButton}
            onPress={() => setShowProfileImageModal(false)}
          >
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          <Image 
            source={{ uri: user?.photo_url || authUser?.photoURL || '' }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
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
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  fullProfileCard: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
    backgroundColor: '#2A2A2A',
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 16,
  },
  fullProfileName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  profileDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  detailIcon: {
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: colors.darkGray,
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  editProfileButton: {
    backgroundColor: colors.primary,
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
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
});