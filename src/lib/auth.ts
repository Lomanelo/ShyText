import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { AuthSessionResult, makeRedirectUri } from 'expo-auth-session';
import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '@firebase/auth';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';

import { auth, checkUserProfileExists, signInWithGoogleCredential, signInWithAppleCredential, database } from './firebase';
import { ref, set } from 'firebase/database';
import { CryptoUtils } from '../utils/CryptoUtils';

// Register web browser for redirect login flow
WebBrowser.maybeCompleteAuthSession();

// Google client IDs
const webClientId = '680911194317-p9h15n8unj1dosd684i6qaina3n2rdam.apps.googleusercontent.com';
const iosClientId = '680911194317-g3amhmkgvie7gdmdcalkn14p46ralg1h.apps.googleusercontent.com';
const androidClientId = '680911194317-p9h15n8unj1dosd684i6qaina3n2rdam.apps.googleusercontent.com';

// Add a helper function to translate Firebase error messages to user-friendly messages
const getFirebaseErrorMessage = (error: any): string => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  // Extract the error code if it's a Firebase error
  const errorCode = errorMessage.match(/\(([^)]+)\)/)?.[1] || '';
  
  // Map Firebase error codes to user-friendly messages
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This account already exists. Please try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid username.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'Account not found. Please check your username or create a new account.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use a stronger password.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/internal-error':
      return 'Something went wrong. Please try again later.';
    case 'auth/invalid-credential':
      return 'Invalid login credentials. Please try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email but different sign-in method.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled. Please try again.';
    default:
      // For unhandled cases, provide a more generic message but log the actual error
      console.error('Unhandled Firebase error:', errorMessage);
      return 'Unable to complete your request. Please try again.';
  }
};

// Hook for Google authentication
export function useGoogleAuth() {
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create a proper redirect URI for iOS standalone apps
  // This is crucial for ad hoc distribution builds
  const redirectUri = Platform.OS === 'ios' 
      ? 'com.rahimrady.myshytext://'
      : (Platform.OS === 'android' 
        ? 'com.rahimrady.myshytext:/oauth2redirect' 
        : 'https://auth.expo.io/@rahimrady/myshytext');
        
  console.log("Configured redirect URI:", redirectUri);
  console.log("App ownership:", Constants.appOwnership);
  console.log("Platform:", Platform.OS);
  
  // Use native configuration for standalone builds
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
    iosClientId: iosClientId, 
    androidClientId: androidClientId,
    redirectUri: redirectUri,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    handleGoogleResponse(response);
  }, [response]);

  const handleGoogleResponse = async (response: AuthSessionResult | null) => {
    if (!response) return;
    
    try {
      if (response.type === 'success') {
        setLoading(true);
        setError(null);
        
        console.log("Auth response parameters:", JSON.stringify(response.params));
        
        // Get id_token from response
        const { id_token } = response.params;
        
        if (!id_token) {
          console.error("No ID token received in response");
          setError("Sign-in failed. Please try again.");
          setLoading(false);
          return;
        }
        
        try {
          // Sign in with Firebase using the Google ID token
          const userCredential = await signInWithGoogleCredential(id_token);
          const user = userCredential.user;
          
          console.log("User signed in:", user.uid);
          
          setUserInfo(user);
          
          // Check if user profile already exists
          const profileExists = await checkUserProfileExists(user.uid);
          
          // Navigate to the profile completion screen or main app based on profile existence
          if (profileExists) {
            console.log("User profile exists, redirecting to main app");
            router.replace('/(tabs)');
          } else {
            console.log("User profile does not exist, redirecting to profile completion");
            router.replace('/(auth)/profile');
          }
        } catch (firebaseError) {
          console.error("Firebase sign-in error:", firebaseError);
          setError(getFirebaseErrorMessage(firebaseError));
        }
      } else if (response.type === 'error') {
        console.error("Auth error response:", response.error);
        setError(`Sign-in failed. ${response.error?.message ? 'Please try again.' : 'Please try again later.'}`);
      } else if (response.type === 'cancel') {
        console.log("Sign-in was cancelled");
        // Don't set error for user cancellation
      } else {
        console.log("Other response type:", response.type);
      }
    } catch (e) {
      console.error("Sign-in error:", e);
      setError("Unable to sign in. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Starting Google sign in process...");
      console.log("Using redirect URI:", redirectUri);
      
      if (!request) {
        setError("Sign-in is unavailable at the moment. Please try again later.");
        console.error("Auth request is null");
        setLoading(false);
        return;
      }
      
      console.log("Prompting for authentication");
      const result = await promptAsync();
      console.log("Prompt result:", result.type);
    } catch (e) {
      console.error("Prompt error:", e);
      setError("We couldn't connect to Google. Please check your internet connection and try again.");
      setLoading(false);
    }
  };

  return {
    signInWithGoogle,
    userInfo,
    loading,
    error,
    request,
    clearError
  };
}

// Hook for Email/Password authentication (for testing purposes)
export function useEmailAuth() {
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if string is in email format
  const isEmail = (input: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  };

  // Convert username to email format if needed for Firebase Auth
  const formatUserInput = (input: string) => {
    if (isEmail(input)) {
      return input; // It's already an email
    }
    // Convert username to email format by appending domain
    return `${input}@shytext.com`;
  };

  const clearError = () => {
    setError(null);
  };

  // Email/Password Sign In
  const signInWithEmail = async (username: string, password: string) => {
    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Format username as email if needed for Firebase
      const formattedInput = formatUserInput(username);
      
      const userCredential = await signInWithEmailAndPassword(auth, formattedInput, password);
      const user = userCredential.user;
      
      setUserInfo(user);
      
      // Check if user profile already exists
      const profileExists = await checkUserProfileExists(user.uid);
      
      // Navigate to the profile completion screen or main app based on profile existence
      if (profileExists) {
        console.log("User profile exists, redirecting to main app");
        router.replace('/(tabs)');
      } else {
        console.log("User profile does not exist, redirecting to profile completion");
        router.replace('/(auth)/profile');
      }
    } catch (e) {
      console.error("Email sign-in error:", e);
      setError(getFirebaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Sign Up
  const signUpWithEmail = async (username: string, password: string) => {
    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Format username as email if needed for Firebase
      const formattedInput = formatUserInput(username);
      
      const userCredential = await createUserWithEmailAndPassword(auth, formattedInput, password);
      const user = userCredential.user;
      
      setUserInfo(user);
      
      // New user, redirect to profile completion
      console.log("New user created, redirecting to profile completion");
      router.replace('/(auth)/profile');
    } catch (e) {
      console.error("Email sign-up error:", e);
      setError(getFirebaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return {
    signInWithEmail,
    signUpWithEmail,
    userInfo,
    loading,
    error,
    clearError
  };
}

// Hook for Apple authentication
export function useAppleAuth() {
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);

  // We need to keep track of the current nonce to verify when signing in
  useEffect(() => {
    // Generate a fresh nonce on component mount
    const generateFreshNonce = async () => {
      const newNonce = CryptoUtils.randomNonceString();
      setNonce(newNonce);
      console.log('Generated fresh nonce:', newNonce);
    };
    
    generateFreshNonce();
  }, []);

  const clearError = () => {
    setError(null);
  };

  const resetLoading = () => {
    setLoading(false);
  };

  const handleSignIn = async (credential: {
    identityToken: string;
    fullName?: AppleAuthentication.AppleAuthenticationFullName | null | undefined;
  }) => {
    try {
      setLoading(true);
      setError(null);

      if (!credential.identityToken || !nonce) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      console.log('Signing in with Apple credential, using nonce:', nonce);
      console.log('Received Apple name data:', credential.fullName);
      
      // Sign in with Firebase using the Apple identity token and original nonce
      const userCredential = await signInWithAppleCredential(credential.identityToken, nonce);
      const user = userCredential.user;
      console.log('Firebase signed in user:', user.uid, user.email);
      
      setUserInfo(user);
      
      // Check if user profile already exists
      const profileExists = await checkUserProfileExists(user.uid);
      console.log('Profile exists:', profileExists);
      
      // If profile exists, go directly to main app
      if (profileExists) {
        console.log("User profile exists, redirecting to main app");
        router.replace('/(tabs)');
        return;
      }
      
      // For new accounts, create profile immediately with Apple data
      if (credential.fullName) {
        const nameData = {
          givenName: credential.fullName.givenName || '',
          familyName: credential.fullName.familyName || ''
        };
        
        console.log('Creating profile directly with Apple data:', nameData);
        
        try {
          // Use name from Apple data
          const firstName = nameData.givenName || nameData.familyName || 'User';
          
          // Create user profile immediately
          const userData = {
            firstName: firstName.trim(),
            email: user.email,
            photoURL: user.photoURL || null,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };
          
          console.log('Profile data to save:', userData);
          
          // Save profile to Firebase Realtime Database
          const userRef = ref(database, 'profiles/' + user.uid);
          await set(userRef, userData);
          console.log('*** PROFILE CREATED SUCCESSFULLY FOR APPLE USER ***');
          
          // Cache the profile locally as well
          await AsyncStorage.setItem('userProfile', JSON.stringify(userData));
          console.log('Profile cached locally');
          
          // Go directly to main app
          console.log("Profile created for Apple user, redirecting to main app");
          router.replace('/(tabs)');
          return;
        } catch (error) {
          console.error('Error creating profile directly:', error);
          console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
          
          // If direct profile creation fails, fall back to profile screen
          // First save the Apple data
          await AsyncStorage.setItem('appleFullName', JSON.stringify(nameData));
          await AsyncStorage.setItem('isAppleSignIn', 'true');
          
          console.log("Failed to create profile directly, falling back to profile screen");
          router.replace('/(auth)/profile');
        }
      } else {
        console.log('No name data received from Apple, redirecting to profile screen');
        router.replace('/(auth)/profile');
      }
    } catch (e) {
      console.error("Apple sign-in error:", e);
      console.error('Stack trace:', e instanceof Error ? e.stack : 'No stack trace');
      setError(getFirebaseErrorMessage(e));
    } finally {
      setLoading(false);
      // Generate a new nonce for next login attempt
      const newNonce = CryptoUtils.randomNonceString();
      setNonce(newNonce);
      console.log('Generated new nonce after sign-in attempt:', newNonce);
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      
      if (!nonce) {
        const freshNonce = CryptoUtils.randomNonceString();
        setNonce(freshNonce);
        console.log('Generated nonce for sign-in:', freshNonce);
        return { nonce: freshNonce };
      }
      
      console.log('Using existing nonce for sign-in:', nonce);
      return { nonce };
    } catch (error) {
      console.error('Error preparing for Apple sign-in:', error);
      setLoading(false);
      throw error;
    }
  };

  return {
    signInWithApple,
    handleSignIn,
    userInfo,
    loading,
    error,
    clearError,
    resetLoading
  };
} 