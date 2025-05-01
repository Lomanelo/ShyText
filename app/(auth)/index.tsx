import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, TextInput, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useGoogleAuth, useEmailAuth } from '../../src/lib/auth';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, checkUserProfileExists } from '../../src/lib/firebase';

export default function WelcomeScreen() {
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleAuth();
  const { signInWithEmail, signUpWithEmail, loading: emailLoading, error: emailError } = useEmailAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [initializing, setInitializing] = useState(true);
  
  const loading = googleLoading || emailLoading || initializing;
  const error = googleError || emailError;

  // Check for authentication state when component mounts
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User already signed in on auth screen, checking profile...");
        try {
          // Check if user profile exists
          const hasProfile = await checkUserProfileExists(user.uid);
          
          // Redirect based on profile status
          if (hasProfile) {
            console.log("User profile exists, redirecting to main app from auth screen");
            router.replace('/(tabs)');
          } else {
            console.log("User needs profile, redirecting to profile from auth screen");
            router.replace('/(auth)/profile');
          }
        } catch (error) {
          console.error("Error checking profile:", error);
        }
      }
      
      setInitializing(false);
    });
    
    return unsubscribe;
  }, []);

  const handleEmailAuth = async (type: 'signin' | 'signup') => {
    if (type === 'signin') {
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password);
    }
  };

  const isExpoGo = Constants.appOwnership === 'expo';

  // Show loading indicator while checking auth state
  if (initializing) {
    return (
      <ImageBackground source={require('../../assets/images/bgimage.png')} style={styles.backgroundImage}>
        <View style={[styles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Checking authentication state...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require('../../assets/images/bgimage.png')} style={styles.backgroundImage}>
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>ShyText</Text>
            <Text style={styles.subtitle}>
              Connect with people nearby,{'\n'}one message at a time
            </Text>
          </View>

          <View style={styles.footer}>
            {!showEmailForm ? (
              <>
                {isExpoGo && (
                  <Text style={styles.expoGoNotice}>
                    Note: Google authentication doesn't work in Expo Go.{'\n'}
                    Please use Email authentication for testing.
                  </Text>
                )}
                
                <TouchableOpacity
                  style={[styles.googleButton, (loading || isExpoGo) && styles.buttonDisabled]}
                  onPress={signInWithGoogle}
                  disabled={loading || isExpoGo}>
                  {googleLoading ? (
                    <ActivityIndicator color="#0055FF" />
                  ) : (
                    <View style={styles.googleButtonContent}>
                      <AntDesign name="google" size={20} color="#0055FF" />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.emailButton, isExpoGo && styles.emailButtonHighlighted]}
                  onPress={() => setShowEmailForm(true)}
                  disabled={loading}>
                  <View style={styles.emailButtonContent}>
                    <AntDesign name="mail" size={20} color="#fff" />
                    <Text style={styles.emailButtonText}>
                      {isExpoGo ? "Use Email Authentication (Recommended)" : "Continue with Email"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              // Email form
              <View style={styles.emailForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
                
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />
                
                <View style={styles.emailButtonsRow}>
                  <TouchableOpacity 
                    style={[styles.emailAuthButton, loading && styles.buttonDisabled]}
                    onPress={() => handleEmailAuth('signin')}
                    disabled={loading}>
                    <Text style={styles.emailAuthButtonText}>
                      {emailLoading ? 'Signing in...' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.emailAuthButton, loading && styles.buttonDisabled]}
                    onPress={() => handleEmailAuth('signup')}
                    disabled={loading}>
                    <Text style={styles.emailAuthButtonText}>
                      {emailLoading ? 'Signing up...' : 'Sign Up'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowEmailForm(false)}
                  disabled={loading}>
                  <Text style={styles.backButtonText}>
                    ← Back to options
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.terms}>
              By continuing, you agree to our{' '}
              <Text style={styles.link}>Terms of Service</Text> and{' '}
              <Text style={styles.link}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    width: '100%',
  },
  expoGoNotice: {
    color: '#ffaa00',
    textAlign: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'rgba(255, 170, 0, 0.2)',
    borderRadius: 8,
  },
  googleButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#0055FF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  emailButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(51, 51, 51, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emailButtonHighlighted: {
    backgroundColor: '#0055FF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  emailButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emailForm: {
    width: '100%',
    marginBottom: 15,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#333',
  },
  emailButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  emailAuthButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0055FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  emailAuthButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: '#ddd',
    fontSize: 16,
  },
  errorText: {
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 10,
    padding: 5,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 4,
  },
  terms: {
    color: '#999',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 5,
  },
  link: {
    color: '#0055FF',
    textDecorationLine: 'underline',
  },
});