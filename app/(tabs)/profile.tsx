import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Group, ListRow } from '../../components/ListRow';
import { cardShadow, type, useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { maskPhone } from '../../utils/phone';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { profile, user, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView
        contentContainerStyle={styles.wrap}
        contentInsetAdjustmentBehavior="automatic"
        alwaysBounceVertical
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={theme.accent} />
        }
      >
        <View style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}>
          <Avatar name={profile?.displayName} uri={profile?.avatarUrl} theme={theme} size={72} />
          <Text style={[type.title, { color: theme.text }]}>
            {profile?.displayName || t('common.you')}
            {profile?.age ? `, ${profile.age}` : ''}
          </Text>
          {profile?.bio ? <Text style={[type.body, { color: theme.muted, textAlign: 'center' }]}>{profile.bio}</Text> : null}
          {user?.phoneNumber ? (
            <Text style={[type.caption, { color: theme.quiet }]}>{maskPhone(user.phoneNumber)}</Text>
          ) : null}
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <PrimaryButton title={t('profile.edit')} theme={theme} variant="secondary" onPress={() => router.push('/settings/edit-profile')} />
          </View>
        </View>
        <Group theme={theme}>
          <ListRow title={t('profile.settings')} theme={theme} last onPress={() => router.push('/settings')} />
        </Group>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16, paddingBottom: 32 },
  card: { borderRadius: 16, borderCurve: 'continuous', padding: 22, alignItems: 'center', gap: 8 },
});
