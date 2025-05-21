import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Alert, Linking, Platform, ActivityIndicator, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, database, uploadProfileImage } from '../../src/lib/firebase';
import { ref, get, update, remove } from 'firebase/database';
import { router } from 'expo-router';
import { signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import ContactForm from '../components/ContactForm';
import { useNotifications } from '../../src/contexts/NotificationContext';
import { cancelAllNotifications, getAllScheduledNotifications } from '../../src/utils/notifications';

export default function SettingsScreen() {
  const [userData, setUserData] = useState<{
    firstName: string;
    photoURL: string | null;
  } | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [updatingName, setUpdatingName] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const { expoPushToken, sendTestNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          router.replace('/(auth)');
          return;
        }

        const userProfileRef = ref(database, `profiles/${currentUser.uid}`);
        const snapshot = await get(userProfileRef);

        if (snapshot.exists()) {
          const profileData = snapshot.val();
          setUserData({
            firstName: profileData.firstName || currentUser.displayName || 'User',
            photoURL: profileData.photoURL || currentUser.photoURL
          });
        } else {
          // Fallback to Firebase user data
          setUserData({
            firstName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  const handleUpdateProfileImage = async () => {
    if (imageUploading) return; // Prevent multiple uploads
    
    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your photos to update your profile picture.');
        return;
      }

      // Launch image picker with simple options
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Lower quality for faster upload
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        // User canceled or no image selected
        return;
      }

      const uri = result.assets[0].uri;
      console.log('Selected image URI:', uri);
      
      // Check if user is authenticated
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be signed in to update your profile picture.');
        return;
      }

      setImageUploading(true);

      try {
        // Process the image and get a data URL
        const dataUrl = await uploadProfileImage(currentUser.uid, uri);
        
        if (!dataUrl) {
          throw new Error('Failed to process image');
        }
        
        console.log('Image processing successful');
        
        // Update profile in Firebase Database with the data URL
        const userProfileRef = ref(database, `profiles/${currentUser.uid}`);
        await update(userProfileRef, {
          photoURL: dataUrl,
          lastUpdated: new Date().toISOString()
        });

        console.log('Database updated successfully');

        // Update local state
        setUserData(prev => prev ? {
          ...prev,
          photoURL: dataUrl
        } : null);
        
        // Success message
        Alert.alert('Success', 'Profile picture updated successfully!');
      } catch (error) {
        console.error('Error during profile picture update:', error);
        Alert.alert('Error', 'Failed to update profile picture. Please try again.');
      }
    } catch (error) {
      console.error('Error in image picker:', error);
      Alert.alert('Error', 'An error occurred while selecting an image.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all user data from AsyncStorage
              await AsyncStorage.multiRemove([
                'userProfile',
                'userHasProfile',
                'lastKnownLocation',
                'userPreferences'
              ]);
              
              // Sign out from Firebase
              await signOut(auth);
              
              // Force navigation to auth screen
              router.replace('/(auth)');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleTestNotification = async () => {
    try {
      setIsLoading(true);
      await sendTestNotification();
      Alert.alert('Success', 'Test notification sent successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
      console.error('Error sending test notification:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  };

  const handleViewScheduledNotifications = async () => {
    try {
      const notifications = await getAllScheduledNotifications();
      if (notifications.length === 0) {
        Alert.alert('Info', 'No scheduled notifications found');
        return;
      }
      
      const notificationList = notifications.map(n => 
        `Title: ${n.content.title}\nBody: ${n.content.body}\nID: ${n.identifier}`
      ).join('\n\n');
      
      Alert.alert('Scheduled Notifications', notificationList);
    } catch (error) {
      Alert.alert('Error', 'Failed to get scheduled notifications');
      console.error('Error getting scheduled notifications:', error);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await cancelAllNotifications();
      Alert.alert('Success', 'All notifications cleared successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear notifications');
      console.error('Error clearing notifications:', error);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    setUpdatingName(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be signed in to update your name');
        return;
      }

      const userProfileRef = ref(database, `profiles/${currentUser.uid}`);
      await update(userProfileRef, {
        firstName: newName.trim(),
        lastUpdated: new Date().toISOString()
      });

      setUserData(prev => prev ? {
        ...prev,
        firstName: newName.trim()
      } : null);

      setShowNameModal(false);
      setNewName('');
      Alert.alert('Success', 'Name updated successfully!');
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert('Error', 'Failed to update name. Please try again.');
    } finally {
      setUpdatingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return;
    }

    setUpdatingPassword(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        Alert.alert('Error', 'No user found. Please sign in again.');
        return;
      }

      // Get the email from the user object
      const email = user.email;
      
      try {
        // Reauthenticate user
        const credential = EmailAuthProvider.credential(email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // Update password
        await updatePassword(user, newPassword);

        // Clear form and close modal
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordModal(false);

        Alert.alert('Success', 'Password updated successfully!');
      } catch (error: any) {
        console.error('Error during password change:', error);
        if (error.code === 'auth/wrong-password') {
          Alert.alert('Error', 'Current password is incorrect');
        } else if (error.code === 'auth/invalid-credential') {
          Alert.alert('Error', 'Invalid credentials. Please check your current password.');
        } else if (error.code === 'auth/requires-recent-login') {
          Alert.alert('Error', 'Please sign out and sign in again before changing your password.');
        } else {
          Alert.alert('Error', 'Failed to update password. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleAccountSettings = () => {
    Alert.alert(
      'Account Settings',
      'What would you like to do?',
      [
        {
          text: 'Change Password',
          onPress: () => setShowPasswordModal(true)
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Account',
              'Are you sure you want to delete your account? This action cannot be undone.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel'
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const user = auth.currentUser;
                      if (!user) {
                        Alert.alert('Error', 'No user found. Please sign in again.');
                        return;
                      }

                      // Delete without password confirmation
                      try {
                        // Delete user data from database first
                        const userProfileRef = ref(database, `profiles/${user.uid}`);
                        await remove(userProfileRef);
                        
                        // Clear local storage
                        await AsyncStorage.multiRemove([
                          'userProfile',
                          'userHasProfile',
                          'lastKnownLocation',
                          'userPreferences'
                        ]);
                        
                        // Delete the user account
                        await user.delete()
                          .then(() => {
                            console.log('User account deleted successfully');
                            // Navigate to auth screen
                            router.replace('/(auth)');
                          })
                          .catch((error: any) => {
                            console.error('Error deleting user account:', error);
                            
                            // Check if this is a credential error (user needs to re-authenticate)
                            if (error.code === 'auth/requires-recent-login') {
                              Alert.alert(
                                'Session Expired',
                                'For security reasons, please sign out and sign in again before deleting your account.',
                                [
                                  {
                                    text: 'OK',
                                    onPress: handleSignOut
                                  }
                                ]
                              );
                            } else {
                              Alert.alert('Error', 'Failed to delete account. Please try again later.');
                            }
                          });
                          
                      } catch (error: any) {
                        console.error('Error during account deletion:', error);
                        Alert.alert('Error', 'Failed to delete account. Please try again later.');
                      }
                    } catch (error) {
                      console.error('Error deleting account:', error);
                      Alert.alert('Error', 'Failed to delete account. Please try again later.');
                    }
                  }
                }
              ]
            );
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  return (
    <LinearGradient colors={['#f9f1e7', '#f9f1e7']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      
      <View style={styles.profileSection}>
        <TouchableOpacity 
          style={styles.profileImageContainer}
          onPress={handleUpdateProfileImage}
          disabled={imageUploading}
        >
          {imageUploading ? (
            <View style={[styles.profileImage, styles.loadingContainer]}>
              <ActivityIndicator size="small" color="#222" />
            </View>
          ) : (
            <Image
              source={userData?.photoURL ? { uri: userData.photoURL } : require('../../assets/images/icon.png')}
              style={styles.profileImage}
            />
          )}
          <View style={styles.editIconContainer}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.profileName}>{userData?.firstName || 'User'}</Text>
        <TouchableOpacity 
          style={styles.changeNameButton}
          onPress={() => {
            setNewName(userData?.firstName || '');
            setShowNameModal(true);
          }}
        >
          <Text style={styles.changeNameText}>Change Name</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingsSection}>
        <TouchableOpacity 
          style={styles.settingsItem}
          onPress={handleAccountSettings}>
          <View style={styles.settingsIconContainer}>
            <Ionicons name="key-outline" size={22} color="#222" />
          </View>
          <Text style={styles.settingsText}>Account Settings</Text>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingsItem}
          onPress={handleOpenSettings}>
          <View style={styles.settingsIconContainer}>
            <Ionicons name="settings-outline" size={22} color="#222" />
          </View>
          <Text style={styles.settingsText}>Notification Settings</Text>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingsItem}
          onPress={() => setShowContactForm(true)}>
          <View style={styles.settingsIconContainer}>
            <Ionicons name="help-circle-outline" size={22} color="#222" />
          </View>
          <Text style={styles.settingsText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showContactForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactForm(false)}
      >
        <View style={styles.modalOverlay}>
          <ContactForm onClose={() => setShowContactForm(false)} />
        </View>
      </Modal>

      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.nameModalContainer}>
            <Text style={styles.nameModalTitle}>Change Name</Text>
            <TextInput
              style={styles.nameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.nameModalButtons}>
              <TouchableOpacity 
                style={[styles.nameModalButton, styles.cancelButton]}
                onPress={() => {
                  setShowNameModal(false);
                  setNewName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.nameModalButton, styles.saveButton]}
                onPress={handleUpdateName}
                disabled={updatingName}
              >
                {updatingName ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.nameModalContainer}>
            <Text style={styles.nameModalTitle}>Change Password</Text>
            
            <TextInput
              style={styles.nameInput}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current Password"
              placeholderTextColor="#999"
              secureTextEntry
            />

            <TextInput
              style={styles.nameInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              placeholderTextColor="#999"
              secureTextEntry
            />

            <TextInput
              style={styles.nameInput}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Confirm New Password"
              placeholderTextColor="#999"
              secureTextEntry
            />

            <View style={styles.nameModalButtons}>
              <TouchableOpacity 
                style={[styles.nameModalButton, styles.cancelButton]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.nameModalButton, styles.saveButton]}
                onPress={handleChangePassword}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#222',
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  editIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#222',
    borderRadius: 15,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f9f1e7',
  },
  profileName: {
    color: '#222',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingsSection: {
    marginTop: 30,
    paddingHorizontal: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsText: {
    color: '#222',
    fontSize: 16,
    flex: 1,
  },
  signOutButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  signOutText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  changeNameButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f2f2f2',
  },
  changeNameText: {
    color: '#222',
    fontSize: 14,
    fontWeight: '600',
  },
  nameModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nameModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#222',
    marginBottom: 20,
  },
  nameModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  nameModalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f2f2f2',
  },
  saveButton: {
    backgroundColor: '#222',
  },
  cancelButtonText: {
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});