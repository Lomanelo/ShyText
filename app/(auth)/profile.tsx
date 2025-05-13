import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, database, uploadProfileImage } from '../../src/lib/firebase';
import { ref, set, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, shadows, borderRadius } from '../../src/styles/theme';

export default function ProfileScreen() {
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        
        if (!user) {
          console.error('No current user found');
          setError('Please sign in again');
          router.replace('/(auth)');
          return;
        }
        
        console.log('Current user:', user.uid);
        
        // Check if profile already exists in Firebase
        try {
          const userProfileRef = ref(database, 'profiles/' + user.uid);
          const snapshot = await get(userProfileRef);
          
          if (snapshot.exists()) {
            const profileData = snapshot.val();
            console.log('Existing profile found:', profileData);
            if (profileData.firstName) {
              setFirstName(profileData.firstName);
            }
            if (profileData.photoURL) {
              setProfileImage(profileData.photoURL);
            }
          } else if (user?.displayName) {
            // Pre-fill the name from Google account if available and no profile exists
            setFirstName(user.displayName.split(' ')[0]);
            // Use photo from Google if available
            if (user.photoURL) {
              setProfileImage(user.photoURL);
            }
          }
        } catch (profileError) {
          console.error('Error fetching profile:', profileError);
          
          // Pre-fill the name from Google account if available as fallback
          if (user?.displayName) {
            setFirstName(user.displayName.split(' ')[0]);
          }
          // Use photo from Google if available
          if (user.photoURL) {
            setProfileImage(user.photoURL);
          }
        }
        
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setInitializing(false);
      }
    };
    
    fetchUserData();
  }, []);

  const pickImage = async () => {
    try {
      setImageUploading(true);
      
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your photos to upload a profile picture.');
        setImageUploading(false);
        return;
      }
      
      // Launch image picker with a timeout to prevent hangs
      const pickPromise = ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image picker timed out')), 30000);
      });
      
      // Race the picker against the timeout
      const result = await Promise.race([pickPromise, timeoutPromise])
        .catch(err => {
          console.error('Image picker error or timeout:', err);
          return { canceled: true } as ImagePicker.ImagePickerResult;
        });
      
      // TypeScript check for result shape
      if (!result || typeof result !== 'object' || !('canceled' in result)) {
        setImageUploading(false);
        return;
      }

      // Now we can safely cast it
      const pickerResult = result as ImagePicker.ImagePickerResult;
      
      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const uri = pickerResult.assets[0].uri;
        
        if (uri) {
          // Immediately display the selected image with local URI
          setProfileImage(uri);
          
          // If user is authenticated, try to upload to Firebase
          if (auth.currentUser) {
            try {
              // Use the helper function to upload the image
              const downloadURL = await uploadProfileImage(auth.currentUser.uid, uri);
              
              // If we got a URL back (not null), update the profile image state
              if (downloadURL) {
                setProfileImage(downloadURL);
              }
            } catch (uploadError) {
              console.error('Error uploading image:', uploadError);
              // Don't change the profile image - keep using the local URI
              // but don't throw an error that would prevent the user from continuing
            }
          } else {
            console.log('Skipping Firebase upload - user not authenticated');
          }
        }
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to select image. Please try again.');
      // Don't block profile creation on image error
    } finally {
      setImageUploading(false);
    }
  };

  const takePicture = async () => {
    try {
      setImageUploading(true);
      
      // Request camera permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your camera to take a profile picture.');
        setImageUploading(false);
        return;
      }
      
      // Launch camera with a timeout to prevent hangs
      const cameraPromise = ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Camera timed out')), 30000);
      });
      
      // Race the camera against the timeout
      const result = await Promise.race([cameraPromise, timeoutPromise])
        .catch(err => {
          console.error('Camera error or timeout:', err);
          return { canceled: true } as ImagePicker.ImagePickerResult;
        });
      
      // TypeScript check for result shape
      if (!result || typeof result !== 'object' || !('canceled' in result)) {
        setImageUploading(false);
        return;
      }
      
      // Now we can safely cast it
      const pickerResult = result as ImagePicker.ImagePickerResult;
      
      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const uri = pickerResult.assets[0].uri;
        
        if (uri) {
          // Immediately display the selected image with local URI
          setProfileImage(uri);
          
          // If user is authenticated, try to upload to Firebase
          if (auth.currentUser) {
            try {
              // Use the helper function to upload the image
              const downloadURL = await uploadProfileImage(auth.currentUser.uid, uri);
              
              // If we got a URL back (not null), update the profile image state
              if (downloadURL) {
                setProfileImage(downloadURL);
              }
            } catch (uploadError) {
              console.error('Error uploading image:', uploadError);
              // Don't change the profile image - keep using the local URI
              // but don't throw an error that would prevent the user from continuing
            }
          } else {
            console.log('Skipping Firebase upload - user not authenticated');
          }
        }
      }
    } catch (err) {
      console.error('Error taking picture:', err);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
      // Don't block profile creation on image error
    } finally {
      setImageUploading(false);
    }
  };

  const handleComplete = async () => {
    if (!firstName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!profileImage) {
      // Show alert but don't block completion
      Alert.alert(
        'No Profile Picture',
        'Do you want to continue without a profile picture?',
        [
          {
            text: 'Add Picture',
            onPress: pickImage,
            style: 'cancel',
          },
          {
            text: 'Continue Anyway',
            onPress: () => saveProfile(),
          },
        ]
      );
      return;
    }

    saveProfile();
  };

  const saveProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current Firebase user
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setError('No user found. Please sign in again.');
        router.replace('/(auth)');
        return;
      }

      console.log('Saving profile for user:', firebaseUser.uid);
      
      // Create user profile data
      const userData = {
        firstName: firstName.trim(),
        email: firebaseUser.email,
        photoURL: profileImage || firebaseUser.photoURL || null,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      
      console.log('Profile data to save:', userData);
      
      // Save profile to Firebase Realtime Database in the profiles collection
      try {
        const userRef = ref(database, 'profiles/' + firebaseUser.uid);
        await set(userRef, userData);
        console.log('Profile saved successfully');
        
        // Cache the profile locally as well
        await AsyncStorage.setItem('userProfile', JSON.stringify(userData));
        
        router.replace('/(tabs)');
      } catch (dbError) {
        console.error('Error saving to database:', dbError);
        
        // Use temporary storage if database fails
        await AsyncStorage.setItem('userProfile', JSON.stringify(userData));
        console.log('Profile saved to local storage as fallback');
        
        // Still allow navigation but inform user
        Alert.alert(
          'Connection Warning',
          'Profile saved locally but could not connect to cloud database. Some features may be limited.',
          [{ text: 'Continue Anyway', onPress: () => router.replace('/(tabs)') }]
        );
      }
    } catch (err) {
      console.error('Complete profile error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <LinearGradient colors={['#1E1E1E', '#0D0D0D']} style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Setting up your profile...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[colors.background, colors.background]} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.content}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Complete your profile</Text>
              <Text style={styles.subtitle}>
                Add your name and a profile picture
              </Text>
            </View>

            <View style={styles.profileImageContainer}>
              {imageUploading ? (
                <View style={styles.imageLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.ui.accent} />
                </View>
              ) : (
                <>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <AntDesign name="user" size={40} color={colors.text.secondary} />
                    </View>
                  )}
                </>
              )}
              
              <View style={styles.imageButtonsContainer}>
                <TouchableOpacity 
                  style={styles.imageButton} 
                  onPress={pickImage}
                  disabled={imageUploading || loading}>
                  <LinearGradient
                    colors={[colors.ui.primary, colors.ui.primary]}
                    style={styles.imageButtonGradient}>
                    <Ionicons name="image" size={16} color={colors.text.light} />
                    <Text style={styles.imageButtonText}>Gallery</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.imageButton} 
                  onPress={takePicture}
                  disabled={imageUploading || loading}>
                  <LinearGradient
                    colors={[colors.ui.primary, colors.ui.primary]}
                    style={styles.imageButtonGradient}>
                    <Ionicons name="camera" size={16} color={colors.text.light} />
                    <Text style={styles.imageButtonText}>Camera</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <AntDesign name="user" size={20} color={colors.text.secondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor={colors.text.tertiary}
                  value={firstName}
                  onChangeText={setFirstName}
                  editable={!loading}
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="words"
                  inputAccessoryViewID={undefined}
                  keyboardType="default"
                  disableFullscreenUI={true}
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <AntDesign name="exclamationcircleo" size={16} color={colors.ui.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={loading}>
              <LinearGradient
                colors={[colors.ui.primary, colors.ui.primary]}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}>
                {loading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator size="small" color={colors.text.light} />
                    <Text style={styles.buttonText}>Creating Profile...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Complete Profile</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.tertiary,
    marginTop: spacing.lg,
    fontSize: typography.fontSize.md,
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 120 : 80,
  },
  headerContainer: {
    marginTop: spacing.xxxl * 2,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.title,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.ui.secondary,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.ui.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  imageLoadingContainer: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.ui.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  imageButton: {
    height: 40,
    width: 110,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
    ...shadows.small,
  },
  imageButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  imageButtonText: {
    color: colors.text.light,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  formContainer: {
    marginBottom: spacing.xl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.small,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  button: {
    height: 52,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...shadows.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text.light,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    marginLeft: spacing.sm,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.ui.error}15`,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.ui.error,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
});