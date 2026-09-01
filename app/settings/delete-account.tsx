import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { type, useTheme } from '../../theme';
import { deleteOwnAccount } from '../../services/auth';
import { useTranslation } from 'react-i18next';

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    Alert.alert(t('settings.deleteConfirmTitle'), t('settings.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAccount'),
        style: 'destructive',
        onPress: () => void run(),
      },
    ]);
  };

  const run = async () => {
    setBusy(true);
    try {
      await deleteOwnAccount();
      router.replace('/(auth)/welcome');
    } catch (err) {
      Alert.alert(t('settings.deleteFailed'), err instanceof Error ? err.message : t('errors.tryAgain'));
      setBusy(false);
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
        <Text style={[type.title, { color: theme.text }]}>{t('settings.deleteTitle')}</Text>
        <Text style={[type.body, { color: theme.muted }]}>
          {t('settings.deleteBody')}
        </Text>
        <Text style={[type.body, { color: theme.muted }]}>
          {t('settings.deleteBody2')}
        </Text>
        <PrimaryButton
          title={t('settings.deleteAccount')}
          theme={theme}
          variant="danger"
          loading={busy}
          onPress={confirm}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 16, paddingBottom: 40 },
});
