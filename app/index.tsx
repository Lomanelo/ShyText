import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import colors from '../src/theme/colors';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is signed in, redirect to tabs
        console.log('User authenticated, redirecting to tabs');
        router.replace('/(tabs)');
      } else {
        // No user, redirect to auth
        console.log('User not authenticated, redirecting to auth');
        router.replace('/(auth)');
      }
    }
  }, [user, loading]);

  // Show loading indicator while checking auth state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // This will only show briefly before redirecting
  return (
    <View style={{ display: 'none' }} />
  );
} 