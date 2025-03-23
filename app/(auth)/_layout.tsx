import { Stack, useRouter, usePathname } from 'expo-router';
import colors from '../../src/theme/colors';
import { useEffect } from 'react';
import { useAuth } from '../../src/hooks/useAuth';

export default function AuthLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Redirect to tabs if user is already authenticated
  useEffect(() => {
    // Don't redirect if on profile-image screen
    const isProfileImageScreen = pathname.includes('profile-image');
    
    if (user && !isProfileImageScreen) {
      router.replace('/(tabs)');
    }
  }, [user, router, pathname]);

  return (
    <Stack screenOptions={{
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTintColor: colors.text,
      headerTitleStyle: {
        fontWeight: 'bold',
        color: colors.text,
      },
      contentStyle: {
        backgroundColor: colors.background,
      },
      headerShadowVisible: false,
    }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Welcome to ShyText',
        }}
      />
      <Stack.Screen
        name="email"
        options={{
          title: 'Email',
        }}
      />
      <Stack.Screen
        name="password"
        options={{
          title: 'Create Password',
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: 'Sign In',
        }}
      />
      <Stack.Screen
        name="display-name"
        options={{
          title: 'Your Name',
        }}
      />
      <Stack.Screen
        name="birthdate"
        options={{
          title: 'Your Birthday',
        }}
      />
      <Stack.Screen
        name="profile-image"
        options={{
          title: 'Profile Photo',
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: 'Complete Profile',
        }}
      />
    </Stack>
  );
}