import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: {
        backgroundColor: '#1a1a1a',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      contentStyle: {
        backgroundColor: '#1a1a1a',
      },
    }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Welcome to ShyText',
        }}
      />
      <Stack.Screen
        name="phone"
        options={{
          title: 'Phone Verification',
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