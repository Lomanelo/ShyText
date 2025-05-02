import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ImageBackground, Platform, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useGoogleAuth } from '../../src/lib/auth';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, checkUserProfileExists } from '../../src/lib/firebase';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/styles/theme';

export default function WelcomeScreen() {
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleAuth();
  const [initializing, setInitializing] = useState(true);
  
  const loading = googleLoading || initializing;
  const error = googleError;

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
            
            <TouchableOpacity
              style={[styles.googleButton, (loading || isExpoGo) && styles.buttonDisabled]}
              onPress={signInWithGoogle}
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
  buttonDisabled: ViewStyle;
  errorText: TextStyle;
  terms: TextStyle;
  link: TextStyle;
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
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: colors.text.error,
    textAlign: 'center',
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
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
});