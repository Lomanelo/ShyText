import React, { useState, useEffect, useRef, memo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Image, Modal, ScrollView, ActivityIndicator, RefreshControl, TextInput, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import colors from '../../src/theme/colors';
import { auth, getCurrentUser, getProfile, uploadProfileImage, updateUserPassword } from '../../src/lib/firebase';
import { signOut, getAuth, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { sendLocalNotification } from '../../src/utils/notifications';
import { useAuth } from '../../src/hooks/useAuth';
import VerifiedBadge from '../../src/components/VerifiedBadge';
import * as DeviceInfo from 'react-native-device-info';
import BleService from '../../src/services/BleService';

export default function SettingsScreen() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [modalAnimationComplete, setModalAnimationComplete] = useState(true);
  const [showGhostModeInfo, setShowGhostModeInfo] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState<boolean>(false);
  const [bleAuthorized, setBleAuthorized] = useState<boolean>(true);
  const [showAccountOptions, setShowAccountOptions] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Check Bluetooth and authorization status
  useEffect(() => {
    const checkBluetoothStatus = async () => {
      try {
        // Get BleService instance
        const bleService = BleService.getInstance();
        
        // Start by initializing - needed for other state checks
        const isEnabled = await bleService.initialize();
        setBluetoothEnabled(isEnabled);
        
        // Now check authorization separately - this is what determines visibility
        const isAuthorized = bleService.isBluetoothAuthorized();
        setBleAuthorized(isAuthorized);
        
        // Log both states for debugging
        console.log(`BT Status - Enabled: ${isEnabled}, Authorized: ${isAuthorized}`);
      } catch (error) {
        console.error('Error checking Bluetooth status:', error);
        setBluetoothEnabled(false);
        setBleAuthorized(false);
      }
    };
    
    checkBluetoothStatus();
    
    // Set up a periodic check every 3 seconds
    const statusInterval = setInterval(checkBluetoothStatus, 3000);
    
    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  // Handle notification settings redirect
  const openNotificationSettings = () => {
    try {
      if (Platform.OS === 'ios') {
        Linking.openURL('app-settings:');
      } else {
        // For Android
        Linking.openSettings();
      }
    } catch (error) {
      console.error('Error opening settings:', error);
      Alert.alert('Error', 'Unable to open settings. Please open your device settings manually.');
    }
  };

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setIsDeleting(true);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('User not authenticated or email not available');
      }
      
      // Re-authenticate before deleting
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Delete the user
      await deleteUser(currentUser);
      
      Alert.alert('Account Deleted', 'Your account has been deleted successfully');
      router.replace('/(auth)');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      let errorMessage = 'Failed to delete account';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsDeleting(false);
      setPassword('');
    }
  };

  // Change password handler
  const handleChangePassword = async () => {
    // Validate input
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    
    if (!newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please enter and confirm your new password');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      // Call the firebase function to update password
      const result = await updateUserPassword(currentPassword, newPassword);
      
      if (result.success) {
        Alert.alert('Success', 'Your password has been updated successfully');
        // Close modal and clear fields
        setShowChangePassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        Alert.alert('Error', result.error || 'Failed to update password');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert('Error', error.message || 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

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
          <Text style={styles.settingsSectionTitle}>App Settings</Text>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingsItem} onPress={openNotificationSettings}>
          <Ionicons name="notifications-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingsItem}
          onPress={() => setShowGhostModeInfo(true)}
        >
          <Ionicons name="eye-off-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Ghost Mode</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingsItem}
          onPress={() => setShowAccountOptions(true)}
        >
          <Ionicons name="person-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Account</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.darkGray} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.settingsText}>Help & Support</Text>
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

      {/* Ghost Mode Info Modal */}
      <Modal
        visible={showGhostModeInfo}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGhostModeInfo(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ghost Mode</Text>
              <TouchableOpacity onPress={() => setShowGhostModeInfo(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.ghostModeIcon}>
                <Ionicons name="eye-off" size={60} color={colors.primary} />
              </View>
              
              <Text style={styles.ghostModeTitle}>How to Go Invisible</Text>
              
              <Text style={styles.ghostModeDescription}>
                {Platform.OS === 'ios' 
                  ? "To become invisible to other users, don't allow Bluetooth permissions for ShyText. When the app doesn't have Bluetooth permissions, other users won't be able to detect you."
                  : "To become invisible to other users, simply toggle off Bluetooth in your device settings. When Bluetooth is off, other users won't be able to detect you on the radar."}
              </Text>
              
              <View style={styles.deviceInfoCard}>
                <Text style={styles.deviceInfoLabel}>Your current status:</Text>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusIndicator, { backgroundColor: bleAuthorized ? colors.success : colors.error }]} />
                  <Text style={styles.deviceInfoValue}>{bleAuthorized ? 'Visible to others' : 'Invisible to others'}</Text>
                </View>
              </View>
              
              <Text style={styles.ghostModeDescription}>
                {Platform.OS === 'ios'
                  ? "When you want to be visible again, allow Bluetooth permissions for ShyText in your device settings."
                  : "When you want to be visible again, simply turn Bluetooth back on in your device settings."}
              </Text>
              
              <Text style={styles.ghostModeInstructions}>
                {Platform.OS === 'ios' ? 
                  `To toggle Bluetooth permissions:
                  \n\n1. Go to your device's Settings
                  \n2. Scroll down and tap on "ShyText"
                  \n3. Toggle off "Bluetooth" to go invisible
                  \n4. Toggle on "Bluetooth" to become visible again
                  \n\nNote: You won't be able to see other users while the app doesn't have Bluetooth permissions.`
                  :
                  `To toggle Bluetooth:
                  \n\n1. Go to your device's settings
                  \n2. Find Bluetooth settings
                  \n3. Toggle Bluetooth off to go invisible
                  \n4. Toggle Bluetooth on to become visible again
                  \n\nNote: You won't be able to see other users while Bluetooth is off.`
                }
              </Text>
              
              <TouchableOpacity 
                style={styles.ghostModeButton}
                onPress={() => {
                  Linking.openSettings();
                  setShowGhostModeInfo(false);
                }}
              >
                <Text style={styles.ghostModeButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Account Options Modal */}
      <Modal
        visible={showAccountOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAccountOptions(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account</Text>
              <TouchableOpacity onPress={() => setShowAccountOptions(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.accountIcon}>
                <Ionicons name="person-circle" size={60} color={colors.primary} />
              </View>
              
              <Text style={styles.accountOptionsTitle}>Account Options</Text>
              
              <TouchableOpacity 
                style={styles.accountOption}
                onPress={() => {
                  setShowAccountOptions(false);
                  setShowChangePassword(true);
                }}
              >
                <Ionicons name="key-outline" size={24} color={colors.primary} />
                <Text style={styles.accountOptionText}>Change Password</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.accountOption}
                onPress={() => {
                  setShowAccountOptions(false);
                  setShowDeleteAccount(true);
                }}
              >
                <Ionicons name="trash-outline" size={24} color={colors.error} />
                <Text style={styles.accountOptionText}>Delete Account</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccount}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDeleteAccount(false);
          setPassword('');
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowDeleteAccount(false);
                  setPassword('');
                }}
              >
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.warningIcon}>
                <Ionicons name="warning" size={60} color={colors.error} />
              </View>
              
              <Text style={styles.warningTitle}>Warning: This Cannot Be Undone</Text>
              
              <Text style={styles.warningDescription}>
                Deleting your account will permanently remove all your data, including:
              </Text>
              
              <View style={styles.bulletPointsContainer}>
                <Text style={styles.bulletPoint}>• Profile information</Text>
                <Text style={styles.bulletPoint}>• Messages and conversations</Text>
                <Text style={styles.bulletPoint}>• Account settings</Text>
                <Text style={styles.bulletPoint}>• All other associated data</Text>
              </View>
              
              <Text style={styles.confirmationText}>
                To confirm deletion, please enter your password:
              </Text>
              
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={colors.darkGray}
                secureTextEntry={true}
                value={password}
                onChangeText={setPassword}
                editable={!isDeleting}
              />
              
              <TouchableOpacity 
                style={[
                  styles.deleteButton,
                  (isDeleting || !password) && styles.disabledButton
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeleting || !password}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete My Account</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowDeleteAccount(false);
                  setPassword('');
                }}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePassword}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowChangePassword(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowChangePassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
              >
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.passwordIcon}>
                <Ionicons name="lock-closed" size={60} color={colors.primary} />
              </View>
              
              <Text style={styles.passwordTitle}>Update Your Password</Text>
              
              <Text style={styles.passwordDescription}>
                Please enter your current password and a new password.
              </Text>
              
              <Text style={styles.inputLabel}>Current Password:</Text>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter current password"
                placeholderTextColor={colors.darkGray}
                secureTextEntry={true}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!isChangingPassword}
              />
              
              <Text style={styles.inputLabel}>New Password:</Text>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter new password"
                placeholderTextColor={colors.darkGray}
                secureTextEntry={true}
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!isChangingPassword}
              />
              
              <Text style={styles.inputLabel}>Confirm New Password:</Text>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                placeholderTextColor={colors.darkGray}
                secureTextEntry={true}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                editable={!isChangingPassword}
              />
              
              <TouchableOpacity 
                style={[
                  styles.changePasswordButton,
                  (isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword) && styles.disabledButton
                ]}
                onPress={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.changePasswordButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowChangePassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                disabled={isChangingPassword}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  ghostModeIcon: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  ghostModeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  ghostModeDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
    lineHeight: 22,
  },
  deviceInfoCard: {
    backgroundColor: colors.lightGray,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  deviceInfoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  deviceInfoValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  ghostModeInstructions: {
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  ghostModeStep: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  ghostModeButton: {
    backgroundColor: colors.primary,
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  ghostModeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningIcon: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  warningDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
    lineHeight: 22,
  },
  bulletPointsContainer: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  bulletPoint: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 22,
  },
  confirmationText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: colors.lightGray,
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    fontSize: 16,
    color: colors.text,
  },
  deleteButton: {
    backgroundColor: colors.error,
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  // Account options modal styles
  accountIcon: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  accountOptionsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  accountOptionText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    fontWeight: '500',
  },
  
  // Change password modal styles
  passwordIcon: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  passwordTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  passwordDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  changePasswordButton: {
    backgroundColor: colors.primary,
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  changePasswordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});