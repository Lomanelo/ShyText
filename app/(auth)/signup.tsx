import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import colors from '../../src/theme/colors';
import * as DeviceInfo from 'react-native-device-info';
import { storeDeviceUUID } from '../../src/lib/firebase';

// Define the getDeviceUUID function directly in this file to avoid import issues
const getDeviceUUID = async (): Promise<string> => {
  try {
    if (Platform.OS === 'android') {
      try {
        const macAddress = await DeviceInfo.getMacAddress();
        if (macAddress && macAddress !== '02:00:00:00:00:00') {
          return `android-${macAddress.replace(/:/g, '')}`;
        }
      } catch (error) {
        console.warn('Could not get MAC address:', error);
      }
    }
    
    try {
      const uniqueId = await DeviceInfo.getUniqueId();
      if (uniqueId) {
        return `${Platform.OS}-${uniqueId}`;
      }
    } catch (error) {
      console.warn('Could not get unique ID:', error);
    }
    
    const deviceName = DeviceInfo.getDeviceNameSync();
    const deviceId = DeviceInfo.getDeviceId();
    
    return `${Platform.OS}-${deviceName}-${deviceId}-${Date.now()}`;
  } catch (error) {
    console.error('Error getting device UUID:', error);
    return `fallback-${Platform.OS}-${Math.random().toString(36).substring(2, 15)}`;
  }
};

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleSubmit = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Validate inputs
      if (!displayName.trim()) throw new Error('Please enter a display name');
      if (!email.trim()) throw new Error('Please enter an email');
      if (!password.trim()) throw new Error('Please enter a password');
      if (password.length < 6) throw new Error('Password must be at least 6 characters');
      
      // Get device UUID before creating the account
      const deviceUUID = await getDeviceUUID();
      console.log('Device UUID for registration:', deviceUUID);
      
      // Create user
      const userCredential = await createUserWithEmailAndPassword(
        getAuth(),
        email.trim(),
        password.trim()
      );
      
      // Store user profile directly with Firestore instead of using setProfile
      const db = getFirestore();
      await setDoc(doc(db, 'profiles', userCredential.user.uid), {
        display_name: displayName.trim(),
        email: email.trim(),
        device_uuid: deviceUUID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // Also store device UUID in a separate collection for better querying
      await storeDeviceUUID(userCredential.user.uid, deviceUUID);
      
      // Update the user's display name
      await updateProfile(userCredential.user, {
        displayName: displayName.trim(),
      });
      
      console.log('User registered successfully with device UUID');
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={styles.placeholderView} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Sign Up</Text>
        <Text style={styles.subtitle}>Create a new account to use ShyText</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkTextBold}>Log In</Text>
            </Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholderView: {
    width: 34, // to balance the back button width
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.darkGray,
    marginBottom: 30,
  },
  errorContainer: {
    backgroundColor: '#FFEEEE', // Light red background for error
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: colors.darkGray,
    fontSize: 16,
  },
  linkTextBold: {
    fontWeight: 'bold',
    color: colors.primary,
  },
}); 