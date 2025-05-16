import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ImageBackground, Platform, ViewStyle, TextStyle, TextInput, Modal, Linking, TouchableWithoutFeedback, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useGoogleAuth, useEmailAuth, useAppleAuth } from '../../src/lib/auth';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, checkUserProfileExists } from '../../src/lib/firebase';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/styles/theme';
import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoUtils } from '../../src/utils/CryptoUtils';

export default function WelcomeScreen() {
  const { signInWithGoogle, loading: googleLoading, error: googleError, clearError: clearGoogleError } = useGoogleAuth();
  const { signInWithEmail, signUpWithEmail, loading: emailLoading, error: emailError, clearError: clearEmailError } = useEmailAuth();
  const { signInWithApple, handleSignIn, loading: appleLoading, error: appleError, clearError: clearAppleError, resetLoading: resetAppleLoading } = useAppleAuth();
  const [initializing, setInitializing] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  
  // Animation values
  const appleButtonAnim = useRef(new Animated.Value(100)).current;
  const googleButtonAnim = useRef(new Animated.Value(100)).current;
  const emailButtonAnim = useRef(new Animated.Value(100)).current;
  const termsTextAnim = useRef(new Animated.Value(100)).current;
  
  const loading = googleLoading || emailLoading || appleLoading || initializing;
  const error = googleError || emailError || appleError;

  // Check if Apple Authentication is available on this device
  useEffect(() => {
    const checkAppleAuthAvailable = async () => {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      setAppleAuthAvailable(isAvailable);
    };
    
    checkAppleAuthAvailable();
  }, []);

  // Animation setup
  useEffect(() => {
    if (!initializing) {
      // Staggered animation for buttons
      Animated.stagger(100, [
        Animated.spring(appleButtonAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        }),
        Animated.spring(googleButtonAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        }),
        Animated.spring(emailButtonAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        }),
        Animated.spring(termsTextAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [initializing]);

  // Function to clear all errors
  const clearAllErrors = () => {
    clearGoogleError && clearGoogleError();
    clearEmailError && clearEmailError();
    clearAppleError && clearAppleError();
  };
  
  // Clear errors when input fields are focused
  const handleInputFocus = () => {
    clearAllErrors();
  };

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

  const isExpoGo = Constants.appOwnership === 'expo';

  const handleEmailSubmit = async () => {
    if (!username || !password) {
      return;
    }

    if (!isLoginMode && password !== confirmPassword) {
      // Show error for password mismatch
      return;
    }

    if (isLoginMode) {
      await signInWithEmail(username, password);
    } else {
      await signUpWithEmail(username, password);
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setShowEmailModal(false);
    setIsLoginMode(false);
  };

  const openTerms = () => {
    Linking.openURL('https://shytext.com/terms');
  };

  const openPrivacy = () => {
    Linking.openURL('https://shytext.com/privacy');
  };

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
    <TouchableWithoutFeedback onPress={clearAllErrors}>
    <ImageBackground source={require('../../assets/images/bgimage.png')} style={styles.backgroundImage}>
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>ShyText</Text>
            <Text style={styles.subtitle}>
              Break the <Text style={{ fontWeight: '700' }}>ice</Text>,{'\n'}
              not the <Text style={{ fontWeight: '700' }}>silence</Text>.
            </Text>
          </View>

          <View style={styles.footer}>
                {isExpoGo && (
                  <Text style={styles.expoGoNotice}>
                    Note: Google authentication doesn't work in Expo Go.{'\n'}
                Please build a development build to test authentication.
                  </Text>
                )}
                
                {Platform.OS === 'ios' && appleAuthAvailable && (
                  <Animated.View style={{
                    transform: [{ translateY: appleButtonAnim }],
                    opacity: appleButtonAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: [1, 0]
                    })
                  }}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={borderRadius.pill / 2}
                    style={styles.appleButton}
                    onPress={async () => {
                      try {
                        clearAllErrors();
                        const { nonce } = await signInWithApple();
                        console.log("Got nonce for Apple Sign In:", nonce);
                        
                        // SHA256 hash the nonce for Apple Sign In
                        const hashedNonce = await CryptoUtils.sha256(nonce || '');
                        console.log("Hashed nonce for Apple Sign In:", hashedNonce);
                        
                        const credential = await AppleAuthentication.signInAsync({
                          requestedScopes: [
                            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                            AppleAuthentication.AppleAuthenticationScope.EMAIL,
                          ],
                          nonce: hashedNonce,
                        });
                        
                        if (credential.identityToken) {
                          console.log("Got identity token from Apple, sending to Firebase with original nonce");
                          await handleSignIn({
                            identityToken: credential.identityToken,
                            fullName: credential.fullName || undefined
                          });
                        } else {
                          console.error('No identity token received from Apple');
                          resetAppleLoading();
                        }
                      } catch (e: any) {
                        if (e.code !== 'ERR_CANCELED') {
                          console.error('Apple sign in error:', e);
                        } else {
                          console.log('Apple sign in was cancelled by user');
                        }
                        // Make sure to reset loading state when cancelled or on error
                        resetAppleLoading();
                      } finally {
                        // Ensure loading state is reset in all cases
                        resetAppleLoading();
                      }
                    }}
                  />
                  </Animated.View>
                )}
                
                <Animated.View style={{
                  transform: [{ translateY: googleButtonAnim }],
                  opacity: googleButtonAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: [1, 0]
                  })
                }}>
                <TouchableOpacity
                  style={[styles.googleButton, (loading || isExpoGo) && styles.buttonDisabled]}
                    onPress={() => {
                      clearAllErrors();
                      signInWithGoogle();
                    }}
                  disabled={loading || isExpoGo}>
                  {googleLoading ? (
                <ActivityIndicator color={colors.text.primary} />
                  ) : (
                    <View style={styles.googleButtonContent}>
                  <AntDesign name="google" size={20} color={colors.text.primary} />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </View>
                  )}
                </TouchableOpacity>
                </Animated.View>

                <Animated.View style={{
                  transform: [{ translateY: emailButtonAnim }],
                  opacity: emailButtonAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: [1, 0]
                  })
                }}>
                <TouchableOpacity
                  style={[styles.emailButton, loading && styles.buttonDisabled]}
                    onPress={() => {
                      clearAllErrors();
                      setShowEmailModal(true);
                    }}
                  disabled={loading}>
                  <View style={styles.emailButtonContent}>
                    <Ionicons name="person-outline" size={20} color={colors.text.primary} />
                    <Text style={styles.emailButtonText}>Sign in with Username</Text>
                  </View>
                </TouchableOpacity>
                </Animated.View>

              {!showEmailModal && error && <Text style={styles.errorText}>{error}</Text>}

              <Animated.View style={{
                transform: [{ translateY: termsTextAnim }],
                opacity: termsTextAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: [1, 0]
                })
              }}>
              <Text style={styles.terms}>
                By continuing, you agree to our{' '}
                <Text style={styles.link} onPress={openTerms}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.link} onPress={openPrivacy}>Privacy Policy</Text>
              </Text>
              </Animated.View>
          </View>

          <Modal
            visible={showEmailModal}
            transparent
            animationType="slide"
            onRequestClose={resetForm}
          >
              <TouchableWithoutFeedback onPress={clearAllErrors}>
            <View style={styles.modalOverlay}>
                  <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {isLoginMode ? 'Sign in with Username' : 'Create Account'}
                </Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={colors.text.secondary}
                  value={username}
                  onChangeText={setUsername}
                        onFocus={handleInputFocus}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={colors.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                        onFocus={handleInputFocus}
                  secureTextEntry
                />

                {!isLoginMode && (
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor={colors.text.secondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                          onFocus={handleInputFocus}
                    secureTextEntry
                  />
                )}

                      {error && <Text style={styles.modalErrorText}>{error}</Text>}
                      
                      {!isLoginMode && password && confirmPassword && password !== confirmPassword && (
                        <Text style={styles.modalErrorText}>Passwords do not match</Text>
                      )}

                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.buttonDisabled]}
                        onPress={() => {
                          clearAllErrors();
                          handleEmailSubmit();
                        }}
                  disabled={loading}>
                  {emailLoading ? (
                    <ActivityIndicator color={colors.text.primary} />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {isLoginMode ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => {
                          clearAllErrors();
                    setIsLoginMode(!isLoginMode);
                    setPassword('');
                    setConfirmPassword('');
                  }}>
                  <Text style={styles.switchModeText}>
                    {isLoginMode ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                        onPress={() => {
                          clearAllErrors();
                          resetForm();
                        }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
                  </TouchableWithoutFeedback>
            </View>
              </TouchableWithoutFeedback>
          </Modal>
        </View>
      </LinearGradient>
    </ImageBackground>
    </TouchableWithoutFeedback>
  );
}

type Styles = {
  backgroundImage: ViewStyle;
  overlay: ViewStyle;
  container: ViewStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  content: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  footer: ViewStyle;
  expoGoNotice: TextStyle;
  googleButton: ViewStyle;
  googleButtonContent: ViewStyle;
  googleButtonText: TextStyle;
  emailButton: ViewStyle;
  emailButtonContent: ViewStyle;
  emailButtonText: TextStyle;
  buttonDisabled: ViewStyle;
  errorText: TextStyle;
  terms: TextStyle;
  link: TextStyle;
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  modalTitle: TextStyle;
  input: TextStyle;
  loginButton: ViewStyle;
  loginButtonText: TextStyle;
  cancelButton: ViewStyle;
  cancelButtonText: TextStyle;
  switchModeButton: ViewStyle;
  switchModeText: TextStyle;
  modalErrorText: TextStyle;
  appleButton: ViewStyle;
};

const styles = StyleSheet.create<Styles>({
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
    padding: spacing.xl,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: colors.text.light,
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: typography.fontSize.header,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: typography.fontSize.xl,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 34,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  footer: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  expoGoNotice: {
    color: colors.ui.warning,
    textAlign: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 170, 0, 0.15)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  googleButton: {
    width: '100%',
    height: 56,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  googleButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  emailButton: {
    width: '100%',
    height: 56,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  emailButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  emailButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginVertical: 10,
    fontSize: typography.fontSize.sm,
  },
  terms: {
    color: colors.text.light,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    marginTop: spacing.lg,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  link: {
    color: colors.text.light,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: colors.text.light,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.large,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: colors.ui.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  loginButtonText: {
    color: colors.text.light,
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  cancelButton: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.md,
  },
  switchModeButton: {
    width: '100%',
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  switchModeText: {
    color: colors.ui.primary,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  modalErrorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginVertical: 10,
    fontSize: typography.fontSize.sm,
    padding: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: borderRadius.md,
    width: '100%',
  },
  appleButton: {
    width: '100%',
    height: 56,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
});