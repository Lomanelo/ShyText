import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Image, Platform, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { completeRegistration, getRegistrationData, auth, getCurrentUser, uploadProfileImage } from '../../src/lib/firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';
import colors from '../../src/theme/colors';
import { registerForPushNotifications } from '../../src/lib/notifications';

export default function ProfileImageScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    
    // Verify that registration data exists
    const regData = getRegistrationData();
    if (!regData) {
      // No registration in progress, redirect to start
      Alert.alert(
        'Error',
        'Registration data not found. Please start the registration process again.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)' as any) }]
      );
    }
  }, []);

  const handleBack = () => {
    router.back();
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
        setError(null);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      setError('Error selecting image. Please try again.');
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
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
        setError(null);
      }
    } catch (err) {
      console.error('Error taking picture:', err);
      setError('Error taking picture. Please try again.');
    }
  };

  const handleUpload = async () => {
    try {
      setLoading(true);
      setError(null);
      setUploadProgress(10); // Start progress
      
      // Get registration data
      const regData = getRegistrationData();
      if (!regData || !regData.email || !regData.password) {
        setError('Missing registration data');
        setLoading(false);
        setUploadProgress(0);
        return;
      }
      
      setUploadProgress(30); // Account creation starting
      console.log('Creating user account first...');
      // First complete registration to create the user account
      const registrationResult = await completeRegistration();
      if (!registrationResult.success) {
        setError(`Failed to create account: ${registrationResult.error}`);
        setLoading(false);
        setUploadProgress(0);
        return;
      }
      
      setUploadProgress(60); // Account created
      
      // Get the newly created user
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setError('Failed to get current user after registration');
        setLoading(false);
        setUploadProgress(0);
        return;
      }
      
      const userId = currentUser.uid;
      console.log(`Account created successfully with ID: ${userId}`);
      
      // If we have an image, try to upload it
      if (image) {
        setUploadProgress(70); // Image upload starting
        console.log('Now uploading profile image...');
        const uploadResult = await uploadProfileImage(image, userId);
        
        if (!uploadResult.success) {
          console.warn(`Image upload failed but account was created: ${uploadResult.error}`);
          
          // Check if it's an image size error
          if (uploadResult.error && uploadResult.error.toString().includes('too large')) {
            setError('Image is too large. Please try a smaller image.');
            setUploadProgress(0);
            return; // Don't navigate away yet so user can try another image
          } else {
            // For other errors, continue with navigation
            Alert.alert(
              'Account Created',
              'Your account was created successfully, but we had trouble uploading your profile image. You can try again in settings.',
              [{ text: 'OK' }]
            );
          }
        } else {
          console.log('Profile image uploaded successfully');
          setUploadProgress(100); // Complete
        }
      } else {
        setUploadProgress(100); // Complete without image
      }
      
      // Request notification permissions now that registration is complete
      try {
        console.log('Requesting notification permissions after registration...');
        await registerForPushNotifications();
      } catch (notificationError) {
        console.warn('Failed to register for notifications:', notificationError);
        // Continue with registration completion even if notification registration fails
      }
      
      // Regardless of image upload result (unless it's a size error that we caught above), proceed to main app
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500); // Small delay to show completed progress
    } catch (err: any) {
      console.error('Error during signup:', err);
      setError(`Failed to sign up: ${err.message || 'Unknown error'}`);
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip image upload but still complete registration
    handleUpload();
  };
  
  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      router.push('/(auth)' as any);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <LinearGradient
        colors={[colors.background, colors.lightGray]}
        style={styles.background}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile Picture</Text>
          <Text style={styles.subtitle}>Add a photo so others can recognize you</Text>
        </View>
        
        <View style={styles.formContainer}>
          <View style={styles.stepIndicator}>
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepActive}><Text style={styles.stepText}>5</Text></View>
          </View>
          
          <View style={styles.completeText}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={styles.completeLabel}>Last step - almost done!</Text>
          </View>
            
          <TouchableOpacity 
            style={styles.imageContainer} 
            onPress={pickImage}
            disabled={loading}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} />
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="person" size={48} color={colors.darkGray} />
                <Text style={styles.placeholderText}>Tap to select</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.imageButtons}>
            <TouchableOpacity 
              style={styles.imageButton}
              onPress={pickImage}
              disabled={loading}>
              <Ionicons name="images" size={20} color={colors.text} />
              <Text style={styles.imageButtonText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.imageButton}
              onPress={takePicture}
              disabled={loading}>
              <Ionicons name="camera" size={20} color={colors.text} />
              <Text style={styles.imageButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
          
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          {loading && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
              <Text style={styles.progressText}>{`${uploadProgress}%`}</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleUpload}
            disabled={loading}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}>
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>
                  {image ? 'Complete Signup' : 'Skip for now'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          {!loading && (
            <TouchableOpacity 
              style={styles.signOutLink}
              onPress={handleSignOut}>
              <Text style={styles.signOutText}>Cancel registration</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 30,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 8,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.darkGray,
    textAlign: 'center',
  },
  formContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 24,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepComplete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepInactive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mediumGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepDivider: {
    width: 20,
    height: 1,
    backgroundColor: colors.mediumGray,
    marginHorizontal: 5,
  },
  completeText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  completeLabel: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  imageContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.lightGray,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.darkGray,
    marginTop: 8,
    fontSize: 14,
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  imageButtonText: {
    color: colors.text,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: colors.error,
    marginLeft: 8,
    fontSize: 14,
  },
  progressContainer: {
    height: 20,
    backgroundColor: colors.lightGray,
    borderRadius: 10,
    marginVertical: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 10,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 18,
  },
  button: {
    height: 54,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
  signOutLink: {
    alignItems: 'center',
    marginTop: 16,
    padding: 8,
  },
  signOutText: {
    color: colors.darkGray,
    fontSize: 14,
  },
});