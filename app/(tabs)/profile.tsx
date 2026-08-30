import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { memberSince } from '../../utils/dates';
import { signOut } from '../../services/auth';

export default function ProfileScreen() {
  const theme = useTheme();
  const { profile, user } = useAuth();

  return (
    <Screen theme={theme}>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Avatar name={profile?.displayName} uri={profile?.avatarUrl} theme={theme} size={72} />
          <Text style={[styles.name, { color: theme.text }]}>
            {profile?.displayName || 'You'}
            {profile?.age ? `, ${profile.age}` : ''}
          </Text>
          {profile?.bio ? <Text style={{ color: theme.muted }}>{profile.bio}</Text> : null}
          <Text style={{ color: theme.quiet }}>
            Member since {profile?.createdAt ? memberSince(profile.createdAt) : 'now'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.row}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Settings</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings/privacy')} style={styles.row}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Privacy</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings/blocked-users')} style={styles.row}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Blocked users</Text>
        </Pressable>
        <Text style={{ color: theme.quiet, fontSize: 12 }}>{user?.uid ? `id ${user.uid.slice(0, 8)}` : ''}</Text>
        <PrimaryButton
          title="Sign out"
          theme={theme}
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14 },
  title: { fontSize: 32, fontWeight: '800' },
  card: { borderRadius: 22, padding: 22, alignItems: 'center', gap: 8 },
  name: { fontSize: 24, fontWeight: '800' },
  row: { paddingVertical: 16 },
});
