import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Image, Platform, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { launchImageLibraryAsync, launchCameraAsync, MediaTypeOptions } from 'expo-image-picker';
import { getAuth, updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { getFirestore, doc, updateDoc, setDoc } from 'firebase/firestore';

export default function ProfileImageScreen() {
  // State for image selection and upload
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [completed, setCompleted] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

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
        'Error',
        'You must be logged in to upload a profile picture.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)') }]
      );
    }
  }, []);

  const pickImage = async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
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
        aspect: [1, 1],
        quality: 0.7,
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

  const uploadProfileImage = async (imageUri: string, userId: string): Promise<{ success: boolean, url?: string, error?: any }> => {
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
            // Upload completed successfully
            try {
              console.log('Upload completed, getting download URL');
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Got download URL:', downloadURL);
              
              // Update user profile with photo URL
              const auth = getAuth();
              if (auth.currentUser) {
                console.log('Updating user auth profile with photo URL');
                await updateProfile(auth.currentUser, {
                  photoURL: downloadURL,
                });
                
                // Also update user document in Firestore
                try {
                  const db = getFirestore();
                  
                  // Try to update in both profile collections for compatibility
                  try {
                    console.log('Updating Firestore profiles collection with photo URL');
                    await updateDoc(doc(db, 'profiles', userId), {
                      photoURL: downloadURL,
                      updated_at: new Date().toISOString()
                    });
                  } catch (profileError) {
                    console.log('Failed to update profiles collection:', profileError);
                    // Ignore if this fails - might not exist
                  }
                  
                  try {
                    console.log('Updating Firestore users collection with photo URL');
                    await updateDoc(doc(db, 'users', userId), {
                      photoURL: downloadURL,
                      updatedAt: new Date().toISOString()
                    });
                  } catch (userError) {
                    console.log('Failed to update users collection:', userError);
                    // Ignore if this fails - might not exist
                  }
                  
                  console.log('Profile image successfully saved to user profile');
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
      
      const uploadResult = await uploadProfileImage(selectedImage, user.uid);
      
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
    // Navigate directly to the main app without requiring a profile image
    router.replace('/(tabs)');
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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Profile Pic</Text>
            <Text style={styles.subtitle}>Show others who you are! You can change this anytime.</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.imageContainer} 
            onPress={pickImage}
            disabled={uploading}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.image} />
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="person" size={64} color="#AAAAAA" style={styles.placeholderIcon} />
                <Text style={styles.placeholderText}>Tap to select</Text>
              </View>
            )}
          </TouchableOpacity>
           
          <View style={styles.photoButtonsContainer}>
            <TouchableOpacity 
              style={styles.photoButton} 
              onPress={pickImage}
              disabled={uploading}>
              <Ionicons name="images" size={24} color="#FFFFFF" />
              <Text style={styles.buttonText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.photoButton} 
              onPress={takePicture}
              disabled={uploading}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
              <Text style={styles.buttonText}>Camera</Text>
            </TouchableOpacity>
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
              <View style={styles.uploadedImageContainer}>
                {uploadedImageUrl ? (
                  <Image 
                    source={{ uri: uploadedImageUrl }} 
                    style={styles.uploadedImage}
                    onError={() => console.error('Error loading uploaded image')} 
                  />
                ) : (
                  <Ionicons name="person" size={64} color="#4CD964" style={styles.completeIcon} />
                )}
              </View>
              <Ionicons name="checkmark-circle" size={64} color="#4CD964" style={styles.completeIcon} />
              <Text style={styles.completeText}>Profile picture uploaded!</Text>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={uploading}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.continueButton, !selectedImage && styles.disabledButton]}
                onPress={handleUpload}
                disabled={uploading || !selectedImage}>
                <LinearGradient
                  colors={['#FF5E3A', '#FF2A68']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {uploading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.continueText}>Upload Photo</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Dark background
  },
  safeArea: {
    flex: 1,
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
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#BBBBBB',
    textAlign: 'center',
    marginBottom: 36,
  },
  imageContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FF5E3A',
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
    color: '#BBBBBB',
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
    marginBottom: 36,
  },
  photoButton: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF5E3A',
  },
  progressText: {
    color: '#BBBBBB',
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
    color: '#BBBBBB',
    fontSize: 16,
    textAlign: 'center',
  },
  continueButton: {
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 24,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: '#FF453A',
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
    color: '#FFFFFF',
    textAlign: 'center',
  },
  uploadedImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#4CD964',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
});