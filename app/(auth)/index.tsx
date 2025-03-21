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
import { useAuth } from '../../src/hooks/useAuth';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullUsername, setFullUsername] = useState('');
  const { user, loading: authLoading } = useAuth();

  // If already authenticated, redirect to tabs
  useEffect(() => {
    if (user) {
      console.log('User already authenticated, redirecting to tabs');
      router.replace('/(tabs)');
    }
  }, [user]);

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
    <View style={styles.container}>
      <SafeAreaView style={styles.safeAreaContainer}>
        <StatusBar style="dark" />
        
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
                <Ionicons name="person-outline" size={20} color="rgba(0,0,0,0.6)" style={styles.inputIcon} />
                <View style={styles.usernameInputContainer}>
                  <TextInput
                    style={styles.usernameInput}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter username"
                    placeholderTextColor="rgba(0,0,0,0.4)"
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
                <Ionicons name="lock-closed-outline" size={20} color="rgba(0,0,0,0.6)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(0,0,0,0.4)"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={colors.error} style={{marginRight: 8}} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle-outline" size={16} color="rgba(0,0,0,0.6)" style={{marginRight: 8, marginTop: 2}} />
              <Text style={styles.noteText}>
                Your device name must match your full username including @shytext to enable Bluetooth discovery.
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeAreaContainer: {
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
    color: colors.primary,
    marginTop: 10,
    letterSpacing: 1,
  },
  card: {
    width: '100%',
    backgroundColor: colors.lightGray,
    borderRadius: 16,
    padding: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: colors.text,
    fontSize: 16,
  },
  usernameInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameInput: {
    flex: 1,
    height: 50,
    color: colors.text,
    fontSize: 16,
  },
  usernameSuffix: {
    color: colors.darkGray,
    fontSize: 16,
    paddingRight: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 14,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.mediumGray,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  noteText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  primaryButton: {
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.mediumGray,
  },
  orText: {
    color: colors.darkGray,
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 12,
  },
  createAccountButton: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAccountText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
    color: colors.darkGray,
    textAlign: 'center',
    marginTop: 24,
  },
});