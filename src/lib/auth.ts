import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { AuthSessionResult, makeRedirectUri } from 'expo-auth-session';
import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import Constants from 'expo-constants';

import { auth, signInWithGoogleCredential, cacheAuthState } from './firebase';

// Register web browser for redirect login flow
WebBrowser.maybeCompleteAuthSession();

// Google client IDs
const webClientId = '680911194317-p9h15n8unj1dosd684i6qaina3n2rdam.apps.googleusercontent.com';
const iosClientId = '680911194317-g3amhmkgvie7gdmdcalkn14p46ralg1h.apps.googleusercontent.com';
const androidClientId = '680911194317-p9h15n8unj1dosd684i6qaina3n2rdam.apps.googleusercontent.com';

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
          setError("Authentication failed: No ID token received");
          setLoading(false);
          return;
        }
        
        try {
          // Sign in with Firebase using the Google ID token
          const userCredential = await signInWithGoogleCredential(id_token);
          const user = userCredential.user;
          
          console.log("User signed in:", user.uid);
          
          // Cache the user data for persistence
          await cacheAuthState(user);
          
          setUserInfo(user);
          
          // Navigate to the profile completion screen or main app
          router.replace('/(auth)/profile');
        } catch (firebaseError) {
          console.error("Firebase sign-in error:", firebaseError);
          setError(`Firebase authentication failed: ${
            firebaseError instanceof Error ? firebaseError.message : 'Unknown error'
          }`);
        }
      } else if (response.type === 'error') {
        console.error("Auth error response:", response.error);
        setError(`Authentication error: ${response.error?.message || 'Unknown error'}`);
      } else {
        console.log("Other response type:", response.type);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred during Google Sign In';
      console.error("Sign-in error:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Starting Google sign in process...");
      console.log("Using redirect URI:", redirectUri);
      
      if (!request) {
        setError("Authentication request was not properly initialized");
        console.error("Auth request is null");
        setLoading(false);
        return;
      }
      
      console.log("Prompting for authentication");
      const result = await promptAsync();
      console.log("Prompt result:", result.type);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to initiate Google Sign In';
      console.error("Prompt error:", errorMessage);
      setError(errorMessage);
      setLoading(false);
    }
  };

  return {
    signInWithGoogle,
    userInfo,
    loading,
    error,
    request,
  };
}

// Hook for Email/Password authentication (for testing purposes)
export function useEmailAuth() {
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email/Password Sign In
  const signInWithEmail = async (email: string, password: string) => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await cacheAuthState(user);
      setUserInfo(user);
      
      router.replace('/(auth)/profile');
    } catch (e) {
      console.error("Email sign-in error:", e);
      setError(e instanceof Error ? e.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Sign Up
  const signUpWithEmail = async (email: string, password: string) => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await cacheAuthState(user);
      setUserInfo(user);
      
      router.replace('/(auth)/profile');
    } catch (e) {
      console.error("Email sign-up error:", e);
      setError(e instanceof Error ? e.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return {
    signInWithEmail,
    signUpWithEmail,
    userInfo,
    loading,
    error
  };
} 