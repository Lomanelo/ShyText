import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Image, Platform, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfileImage, auth, getCurrentUser } from '../../src/lib/firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';

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
          Alert.alert('Permission required', 'Sorry, we need camera roll permissions to make this work!');
        }
      }
    })();
  }, []);

  const pickImage = async () => {
    setError(null);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (err) {
      setError('Failed to pick image. Please try again.');
      console.error('Error picking image:', err);
    }
  };

  const takePicture = async () => {
    setError(null);
    
    try {
      // Request camera permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Sorry, we need camera permissions to make this work!');
          return;
        }
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (err) {
      setError('Failed to take picture. Please try again.');
      console.error('Error taking picture:', err);
    }
  };

  const handleUpload = async () => {
    if (!image) {
      // Skip image upload and go to home screen
      router.replace('/');
      return;
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setError('User not authenticated');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Simulated progress indicator
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);
      
      const result = await uploadProfileImage(image, currentUser.uid);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (result.success) {
        // Navigate to home screen
        setTimeout(() => {
          router.replace('/');
        }, 500); // Small delay to show completed progress
      } else {
        throw new Error(result.error ? (result.error as Error).message : 'Failed to upload profile image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip image upload and go to home screen
    router.replace('/');
  };
  
  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      router.push({
        pathname: '/(auth)'
      });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1e1e2e', '#121218']}
        style={styles.background}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile Picture</Text>
          <Text style={styles.subtitle}>Add a photo so others can recognize you</Text>
        </View>
        
        <BlurView intensity={20} tint="dark" style={styles.formContainer}>
          <View style={styles.completeText}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={styles.completeLabel}>Account setup complete!</Text>
          </View>
            
          <TouchableOpacity 
            style={styles.imageContainer} 
            onPress={pickImage}
            disabled={loading}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} />
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="person" size={48} color="#9ca3af" />
                <Text style={styles.placeholderText}>Tap to select</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.imageButtons}>
            <TouchableOpacity 
              style={styles.imageOptionButton} 
              onPress={pickImage}
              disabled={loading}>
              <Ionicons name="images" size={20} color="#fff" />
              <Text style={styles.imageOptionText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.imageOptionButton} 
              onPress={takePicture}
              disabled={loading}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.imageOptionText}>Camera</Text>
            </TouchableOpacity>
          </View>
          
          {uploadProgress > 0 && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
              <Text style={styles.progressText}>{uploadProgress}%</Text>
            </View>
          )}
          
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#ff4d4f" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleUpload}
            disabled={loading}>
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>
                    {image ? 'Finish' : 'Skip for now'}
                  </Text>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleSignOut}
            disabled={loading}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121218',
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
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  formContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 24,
    backgroundColor: 'rgba(30, 30, 46, 0.6)',
  },
  completeText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  completeLabel: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  imageContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    alignSelf: 'center',
    overflow: 'hidden',
    marginBottom: 24,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9ca3af',
    marginTop: 8,
    fontSize: 14,
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 24,
  },
  imageOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  imageOptionText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  progressContainer: {
    height: 10,
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    borderRadius: 5,
    marginBottom: 16,
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 5,
  },
  progressText: {
    position: 'absolute',
    right: -30,
    top: -5,
    color: '#10b981',
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: 'rgba(254, 226, 226, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: '#ff4d4f',
    marginLeft: 8,
    fontSize: 14,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  signOutButton: {
    marginTop: 16,
    alignItems: 'center',
    padding: 12,
  },
  signOutText: {
    color: '#9ca3af',
    fontSize: 16,
  },
}); 