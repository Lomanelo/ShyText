import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Image,
  KeyboardAvoidingView
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/theme/colors';
import * as DeviceInfo from 'react-native-device-info';
import BleService from '../../src/services/BleService';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullUsername, setFullUsername] = useState('');

  const handleSignUp = () => {
    router.push('/(auth)/signup');
  };

  const handleLogin = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Validate inputs
      if (!username.trim()) {
        setError('Please enter your username');
        setLoading(false);
        return;
      }
      
      if (!password.trim()) {
        setError('Please enter your password');
        setLoading(false);
        return;
      }
      
      // Initialize Bluetooth for discovery (not required for login but helps for future use)
      const bleService = BleService.getInstance();
      await bleService.initialize();
      
      // Strip @shytext suffix if user included it in their input
      let usernameForAuth = username.trim();
      if (usernameForAuth.includes('@shytext')) {
        usernameForAuth = usernameForAuth.split('@shytext')[0];
      }
      
      const tempEmail = `${usernameForAuth.toLowerCase()}@shytext.temp`;
      
      try {
        // Attempt to sign in with the temporary email and password
        const auth = getAuth();
        const userCredential = await signInWithEmailAndPassword(auth, tempEmail, password);
        
        // Success! Navigate to main app
        console.log('Successfully authenticated');
        router.replace('/(tabs)');
        
      } catch (authError: any) {
        console.error('Login error:', authError);
        
        if (authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password') {
          setError('Invalid username or password. Please try again.');
        } else {
          setError(authError.message || 'Authentication failed. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  // Set fullUsername for use in other parts of the component
  useEffect(() => {
    setFullUsername(`${username.trim()}@shytext`);
  }, [username]);

  return (
    <LinearGradient
      colors={['#0C0C0C', '#1E1E1E', '#2A2A2A']}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/translogo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>ShyText</Text>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIcon} />
                <View style={styles.usernameInputContainer}>
                  <TextInput
                    style={styles.usernameInput}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter username"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.usernameSuffix}>@shytext</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#FF6B6B" style={{marginRight: 8}} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.6)" style={{marginRight: 8, marginTop: 2}} />
              <Text style={styles.noteText}>
                Your device name must match your full username including @shytext to enable Bluetooth discovery.
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={loading}
            >
              <LinearGradient
                colors={['#FF5E3A', '#FF2A68']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.gradientButton}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.line} />
            </View>
            
            <TouchableOpacity
              style={styles.createAccountButton}
              onPress={handleSignUp}
            >
              <Text style={styles.createAccountText}>Create New Account</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms and Privacy Policy
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 10,
    letterSpacing: 1,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(40, 40, 40, 0.6)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 58, 0.2)',
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 58, 0.3)',
    overflow: 'hidden',
  },
  inputIcon: {
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    flex: 1,
  },
  noteContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  noteText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    flex: 1,
  },
  primaryButton: {
    borderRadius: 22,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#FF5E3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  orText: {
    color: 'rgba(255, 255, 255, 0.6)',
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  createAccountButton: {
    padding: 14,
    alignItems: 'center',
  },
  createAccountText: {
    color: '#FF5E3A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  usernameInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  usernameSuffix: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    paddingRight: 16,
  },
});