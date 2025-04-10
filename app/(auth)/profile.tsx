import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, database } from '../../src/lib/firebase';
import { ref, set, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

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
        
        if (user?.displayName) {
          // Pre-fill the name from Google account if available
          setFirstName(user.displayName.split(' ')[0]);
        }
        
        // Test database connection
        try {
          const testRef = ref(database, 'test');
          await set(testRef, {
            timestamp: new Date().toISOString(),
            test: true
          });
          console.log('Database connection successful');
        } catch (dbError) {
          console.error('Database connection error:', dbError);
        }
        
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setInitializing(false);
      }
    };
    
    fetchUserData();
  }, []);

  const handleComplete = async () => {
    if (!firstName.trim()) {
      setError('Please enter your name');
      return;
    }

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
        photoURL: firebaseUser.photoURL || null,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      
      console.log('Profile data to save:', userData);
      
      // Save profile to Firebase Realtime Database
      try {
        const userRef = ref(database, 'profiles/' + firebaseUser.uid);
        await set(userRef, userData);
        console.log('Profile saved successfully');
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
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#0055FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>
          Tell us your name to get started
        </Text>

        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor="#666"
          value={firstName}
          onChangeText={setFirstName}
          editable={!loading}
          autoFocus
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={loading}>
          <LinearGradient
            colors={['#007AFF', '#0055FF']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}>
            <Text style={styles.buttonText}>
              {loading ? 'Creating Profile...' : 'Complete Profile'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4444',
    marginBottom: 15,
    textAlign: 'center',
  },
});