import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Group, ListRow } from '../../components/ListRow';
import { cardShadow, type, useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../services/auth';
import { maskPhone } from '../../utils/phone';

export default function ProfileScreen() {
  const theme = useTheme();
  const { profile, user } = useAuth();

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
        <View style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}>
          <Avatar name={profile?.displayName} uri={profile?.avatarUrl} theme={theme} size={72} />
          <Text style={[type.title, { color: theme.text }]}>
            {profile?.displayName || 'You'}
            {profile?.age ? `, ${profile.age}` : ''}
          </Text>
          {profile?.bio ? <Text style={[type.body, { color: theme.muted, textAlign: 'center' }]}>{profile.bio}</Text> : null}
          {user?.phoneNumber ? (
            <Text style={[type.caption, { color: theme.quiet }]}>{maskPhone(user.phoneNumber)}</Text>
          ) : null}
        </View>
        <Group theme={theme}>
          <ListRow title="Settings" theme={theme} onPress={() => router.push('/settings')} />
          <ListRow title="Privacy" theme={theme} onPress={() => router.push('/settings/privacy')} />
          <ListRow title="Blocked users" theme={theme} last onPress={() => router.push('/settings/blocked-users')} />
        </Group>
        <PrimaryButton
          title="Sign out"
          theme={theme}
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16, paddingBottom: 32 },
  card: { borderRadius: 16, borderCurve: 'continuous', padding: 22, alignItems: 'center', gap: 8 },
});
