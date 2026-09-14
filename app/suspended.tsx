import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { PrimaryButton } from '../components/PrimaryButton';
import { type, useTheme } from '../theme';
import { signOut } from '../services/auth';
import { SUPPORT_EMAIL } from '../utils/support';
import { Linking } from 'react-native';

/** Shown when users/{uid}.status === 'suspended'. */
export default function SuspendedScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Screen theme={theme}>
      <View style={styles.wrap}>
        <Text style={[type.title, { color: theme.text }]}>{t('suspended.title')}</Text>
        <Text style={[type.body, { color: theme.muted }]}>{t('suspended.body')}</Text>
        <PrimaryButton
          title={t('settings.helpSupport')}
          theme={theme}
          onPress={() =>
            void Linking.openURL(
              `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('ShyText suspended account')}`
            )
          }
        />
        <PrimaryButton
          title={t('common.signOut')}
          theme={theme}
          variant="secondary"
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
  wrap: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
});
