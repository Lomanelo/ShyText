import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Image, Platform, ActivityIndicator, Alert, ScrollView, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { launchImageLibraryAsync, launchCameraAsync, MediaTypeOptions } from 'expo-image-picker';
import { getAuth, updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { getFirestore, doc, updateDoc, setDoc } from 'firebase/firestore';
import colors from '../../src/theme/colors';

export default function ProfileImageScreen() {
  // State for image selection and upload
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [completed, setCompleted] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [fullImageView, setFullImageView] = useState(false);
  
  // State for birthdate
  const [birthDateInput, setBirthDateInput] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthDateError, setBirthDateError] = useState<string>('');

  useEffect(() => {
    // Request permission for image library
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
        }
      }
    })();
    
    // Check if user is authenticated
    const auth = getAuth();
    if (!auth.currentUser) {
      Alert.alert(
        'Session Error',
        'There was a problem with your account session. Please try signing up again.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)') }]
      );
    } else {
      console.log('User authenticated in profile image screen:', auth.currentUser.uid);
    }
  }, []);

  // Validate birth date format (DD/MM/YYYY)
  const validateBirthDate = (dateStr: string): boolean => {
    setBirthDateError('');
    
    // Check format using regex: DD/MM/YYYY
    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    
    if (!dateRegex.test(dateStr)) {
      setBirthDateError('Please enter date in DD/MM/YYYY format');
      return false;
    }
    
    // Parse the date parts
    const [day, month, year] = dateStr.split('/').map(Number);
    
    // Create date with time set to noon to avoid timezone issues
    // This prevents dates from shifting to the previous day due to timezone conversions
    const dateObj = new Date(year, month - 1, day, 12, 0, 0);
    
    // Check if the date is valid (e.g., not 31/02/2023)
    if (
      dateObj.getDate() !== day ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getFullYear() !== year
    ) {
      setBirthDateError('Invalid date. Please check the day, month, and year.');
      return false;
    }
    
    // Check if date is not in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj > today) {
      setBirthDateError('Birth date cannot be in the future');
      return false;
    }
    
    // Check if user is at least 13 years old
    const minAgeDate = new Date();
    minAgeDate.setFullYear(minAgeDate.getFullYear() - 13);
    minAgeDate.setHours(0, 0, 0, 0);
    if (dateObj > minAgeDate) {
      setBirthDateError('You must be at least 13 years old to use this app');
      return false;
    }
    
    // Set the validated date
    setBirthDate(dateObj);
    return true;
  };

  // Format input as user types: XX/XX/XXXX
  const formatBirthDateInput = (text: string) => {
    // Remove any non-digit characters
    const digits = text.replace(/\D/g, '');
    
    // Format with slashes as user types
    let formattedText = '';
    if (digits.length <= 2) {
      formattedText = digits;
    } else if (digits.length <= 4) {
      formattedText = `${digits.substring(0, 2)}/${digits.substring(2)}`;
    } else {
      formattedText = `${digits.substring(0, 2)}/${digits.substring(2, 4)}/${digits.substring(4, 8)}`;
    }
    
    setBirthDateInput(formattedText);
    
    // Clear validation error while typing
    if (birthDateError && text.length < 10) {
      setBirthDateError('');
    }
    
    // Validate if the full date has been entered
    if (formattedText.length === 10) {
      validateBirthDate(formattedText);
    } else {
      // Clear the date object if input is incomplete
      setBirthDate(null);
    }
  };

  const pickImage = async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
        setError('');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to pick image');
    }
  };

  const takePicture = async () => {
    try {
      const result = await launchCameraAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
        setError('');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      setError('Failed to take picture');
    }
  };

  const uploadProfileImage = async (imageUri: string, userId: string, birthDate: Date | null): Promise<{ success: boolean, url?: string, error?: any }> => {
    try {
      console.log('Starting profile image upload for user:', userId);
      
      // Convert image URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      // File size limit check removed - accepting any file size
      console.log('Image size:', blob.size / (1024 * 1024), 'MB');
      
      // Upload to Firebase Storage
      const storage = getStorage();
      const storageRef = ref(storage, `profile_images/${userId}`);
      
      console.log('Uploading image to Firebase Storage');
      // Use uploadBytesResumable to track progress
      const uploadTask = uploadBytesResumable(storageRef, blob);
      
      return new Promise((resolve) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Get upload progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
            console.log('Upload progress:', Math.round(progress), '%');
          },
          (error) => {
            // Handle errors
            console.error('Upload error:', error);
            resolve({ success: false, error });
          },
          async () => {
            // Upload complete, get download URL
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('File available at', downloadURL);
              
              // Update auth profile photoURL
              const auth = getAuth();
              const user = auth.currentUser;
              
              if (user) {
                console.log('Updating user profile with photo URL');
                await updateProfile(user, {
                  photoURL: downloadURL
                });
                
                try {
                  // Update user profile in Firestore
                  const db = getFirestore();
                  const userRef = doc(db, 'profiles', user.uid);
                  
                  const updateData: any = {
                    photoURL: downloadURL,
                    updated_at: new Date().toISOString()
                  };
                  
                  // Add birth date to profile if provided
                  if (birthDate) {
                    // Store as ISO string to prevent timezone issues
                    updateData.birthDate = birthDate.toISOString().split('T')[0];
                  }
                  
                  await updateDoc(userRef, updateData);
                  console.log('User profile updated with photo URL and birth date');
                  
                  // Also update user document in Firestore
                  try {
                    console.log('Updating Firestore profiles collection with photo URL and birth date');
                    await updateDoc(doc(db, 'profiles', userId), {
                      photoURL: downloadURL,
                      photo_url: downloadURL,
                      birth_date: updateData.birthDate,
                      updated_at: new Date().toISOString()
                    });
                  } catch (profileError) {
                    console.log('Failed to update profiles collection:', profileError);
                    // Ignore if this fails - might not exist
                  }
                  
                  try {
                    console.log('Updating Firestore users collection with photo URL and birth date');
                    await updateDoc(doc(db, 'users', userId), {
                      photoURL: downloadURL,
                      photo_url: downloadURL,
                      birth_date: updateData.birthDate,
                      updatedAt: new Date().toISOString()
                    });
                  } catch (userError) {
                    console.log('Failed to update users collection:', userError);
                    // Ignore if this fails - might not exist
                  }
                  
                  console.log('Profile image and birth date successfully saved to user profile');
                } catch (firestoreError) {
                  console.error('Error updating Firestore document:', firestoreError);
                  // Continue anyway since the auth profile was updated
                }
              } else {
                console.error('No authenticated user found when trying to update profile');
              }
              
              resolve({ success: true, url: downloadURL });
            } catch (finalizeError) {
              console.error('Error in final stage of upload:', finalizeError);
              resolve({ success: false, error: finalizeError });
            }
          }
        );
      });
    } catch (error) {
      console.error('Error in uploadProfileImage:', error);
      return { success: false, error };
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }
    
    if (!birthDate) {
      // Validate birth date input before submitting
      if (!birthDateInput || !validateBirthDate(birthDateInput)) {
        setError('Please enter a valid birth date in DD/MM/YYYY format');
        return;
      }
    }
    
    try {
      setUploading(true);
      setError('');
      
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setError('User not authenticated');
        setUploading(false);
        return;
      }
      
      console.log('Starting image upload for user:', user.uid);
      
      const uploadResult = await uploadProfileImage(selectedImage, user.uid, birthDate);
      
      setUploading(false);
      
      if (uploadResult.success && uploadResult.url) {
        console.log('Image upload successful, URL:', uploadResult.url);
        
        // Verify the URL is accessible
        const isAccessible = await verifyUploadedImage(uploadResult.url);
        if (isAccessible) {
          console.log('Verified image URL is accessible');
          setUploadedImageUrl(uploadResult.url);
        } else {
          console.warn('Image URL is not accessible:', uploadResult.url);
        }
        
        setCompleted(true);
        
        // Verify the profile was updated
        const updatedUser = auth.currentUser;
        if (updatedUser && updatedUser.photoURL) {
          console.log('User profile successfully updated with photo URL');
        } else {
          console.warn('Photo URL not updated in user profile after upload');
        }
        
        // Wait a moment to show completion before redirecting
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 2000);
      } else {
        console.error('Upload failed with result:', uploadResult);
        let errorMessage = 'Failed to upload image';
        
        if (uploadResult.error) {
          if (typeof uploadResult.error === 'object' && uploadResult.error.message) {
            errorMessage = uploadResult.error.message;
          } else if (typeof uploadResult.error === 'string') {
            errorMessage = uploadResult.error;
          }
        }
        
        setError(errorMessage);
        
        // Show alert for better visibility of the error
        Alert.alert(
          'Upload Failed',
          `We couldn't upload your profile picture: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Unexpected error in handleUpload:', error);
      setUploading(false);
      
      let errorMessage = 'An unexpected error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    }
  };

  const handleSkip = () => {
    // Show alert to confirm user wants to skip profile image upload
    Alert.alert(
      'Skip Profile Image?',
      'Having a profile photo helps other users recognize you. Are you sure you want to skip this step?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Skip',
          onPress: () => {
            console.log('User chose to skip profile image upload');
            router.replace('/(tabs)');
          }
        }
      ],
      { cancelable: true }
    );
  };

  // Function to verify uploaded image is accessible
  const verifyUploadedImage = async (url: string): Promise<boolean> => {
    try {
      console.log('Verifying image URL is accessible:', url);
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('Error verifying image URL:', error);
      return false;
    }
  };
  
  // Show full-screen view of selected image
  const toggleFullImageView = () => {
    if (selectedImage || uploadedImageUrl) {
      setFullImageView(!fullImageView);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Complete Your Profile</Text>
              <Text style={styles.subtitle}>Add a profile picture and your birth date</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.fullImageContainer} 
              onPress={pickImage}
              disabled={uploading}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.fullImage} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Ionicons name="images" size={64} color={colors.darkGray} style={styles.placeholderIcon} />
                  <Text style={styles.placeholderText}>Tap to select from gallery</Text>
                </View>
              )}
            </TouchableOpacity>
             
            {/* Birth Date Input */}
            <View style={styles.birthdateSection}>
              <Text style={styles.sectionLabel}>Your Birth Date</Text>
              <View style={styles.birthdateInputContainer}>
                <Ionicons name="calendar" size={22} color={colors.primary} style={styles.birthdateIcon} />
                <TextInput
                  style={styles.birthdateInput}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={colors.darkGray}
                  value={birthDateInput}
                  onChangeText={formatBirthDateInput}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!uploading}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (birthDateInput.length === 10) {
                      validateBirthDate(birthDateInput);
                    }
                  }}
                  blurOnSubmit={true}
                />
              </View>
              {birthDateError ? (
                <Text style={styles.birthdateErrorText}>{birthDateError}</Text>
              ) : (
                <Text style={styles.birthdateHelpText}>Enter your date of birth in DD/MM/YYYY format</Text>
              )}
            </View>
            
            {uploading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>Uploading... {uploadProgress}%</Text>
              </View>
            )}
            
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
            
            {completed ? (
              <View style={styles.completeContainer}>
                <TouchableOpacity 
                  style={styles.uploadedImageContainer}
                  onPress={toggleFullImageView}
                >
                  {uploadedImageUrl ? (
                    <Image 
                      source={{ uri: uploadedImageUrl }} 
                      style={styles.uploadedImage}
                      onError={() => console.error('Error loading uploaded image')} 
                    />
                  ) : (
                    <Ionicons name="person" size={64} color={colors.success} style={styles.completeIcon} />
                  )}
                </TouchableOpacity>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} style={styles.completeIcon} />
                <Text style={styles.completeText}>Profile updated successfully!</Text>
              </View>
            ) : (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.continueButton, (!selectedImage || !birthDate) && styles.disabledButton]}
                  onPress={handleUpload}
                  disabled={uploading || !selectedImage || !birthDate}>
                  {uploading ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={styles.continueText}>Save Profile</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      
      {/* Full-screen image view modal */}
      <Modal
        visible={fullImageView}
        transparent={true}
        animationType="fade"
        onRequestClose={toggleFullImageView}
      >
        <View style={styles.fullscreenModalContainer}>
          <TouchableOpacity 
            style={styles.fullscreenCloseButton}
            onPress={toggleFullImageView}
          >
            <Ionicons name="close-circle" size={36} color={colors.background} />
          </TouchableOpacity>
          <Image 
            source={{ uri: selectedImage || uploadedImageUrl || '' }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.darkGray,
    textAlign: 'center',
    marginBottom: 36,
  },
  fullImageContainer: {
    width: '100%',
    height: 400,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.darkGray,
    textAlign: 'center',
  },
  image: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  photoButton: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.text,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  birthdateSection: {
    width: '100%',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
    fontWeight: '600',
  },
  birthdateInputContainer: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  birthdateIcon: {
    marginRight: 12,
  },
  birthdateInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    padding: 0,
  },
  birthdateHelpText: {
    color: colors.darkGray,
    fontSize: 12,
    marginTop: 8,
  },
  birthdateErrorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 8,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    color: colors.darkGray,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
  },
  skipButton: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  skipText: {
    color: colors.darkGray,
    fontSize: 16,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  continueText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  completeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeIcon: {
    marginBottom: 16,
  },
  completeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  uploadedImageContainer: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.success,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '90%',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  }
});