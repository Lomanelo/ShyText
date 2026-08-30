import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme';

export default function Index() {
  const theme = useTheme();
  const { user, loading, hasProfile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (!hasProfile) return <Redirect href="/(auth)/profile-setup" />;
  return <Redirect href="/(tabs)/nearby" />;
}
