import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Group, ListRow } from '../../components/ListRow';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme, type } from '../../theme';
import { signOut } from '../../services/auth';
import { SUPPORT_EMAIL } from '../../utils/support';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  const openSupport = () => {
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('ShyText support')}`
    );
  };

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
          <ListRow
            title={t('settings.helpSupport')}
            subtitle={SUPPORT_EMAIL}
            theme={theme}
            last
            onPress={openSupport}
          />
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
        <Text style={[type.caption, { color: theme.quiet, textAlign: 'center' }]}>
          {t('settings.supportHint', { email: SUPPORT_EMAIL })}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16, paddingBottom: 40 },
});
