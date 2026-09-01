import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Group, ListRow } from '../../components/ListRow';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';
import { signOut } from '../../services/auth';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
        <Group theme={theme}>
          <ListRow title={t('settings.notifications')} theme={theme} last onPress={() => router.push('/settings/notifications')} />
        </Group>
        <Group theme={theme}>
          <ListRow title={t('settings.privacy')} theme={theme} onPress={() => router.push('/settings/privacy')} />
          <ListRow title={t('settings.blockedUsers')} theme={theme} last onPress={() => router.push('/settings/blocked-users')} />
        </Group>
        <Group theme={theme}>
          <ListRow title={t('settings.privacyPolicy')} theme={theme} onPress={() => router.push('/legal/privacy')} />
          <ListRow title={t('settings.terms')} theme={theme} last onPress={() => router.push('/legal/terms')} />
        </Group>
        <PrimaryButton
          title={t('common.signOut')}
          theme={theme}
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          }}
        />
        <Group theme={theme}>
          <ListRow
            title={t('settings.deleteAccount')}
            theme={theme}
            destructive
            last
            onPress={() => router.push('/settings/delete-account')}
          />
        </Group>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16, paddingBottom: 40 },
});
