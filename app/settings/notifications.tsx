import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Group, SwitchRow } from '../../components/ListRow';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { notificationPrefsOf, updateOwnProfile } from '../../services/auth';
import { registerPushToken, syncCheckInEndingNotice } from '../../services/notifications';
import { useCurrentVenue } from '../../hooks/useCurrentVenue';
import { NotificationPrefs } from '../../types/user';
import { useTranslation } from 'react-i18next';

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { checkIn } = useCurrentVenue();
  const [prefs, setPrefs] = useState<NotificationPrefs>(notificationPrefsOf(profile));
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || !profile) return;
    setPrefs(notificationPrefsOf(profile));
    seeded.current = true;
  }, [profile]);

  const setPref = async (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      if (value) await registerPushToken();
      await updateOwnProfile({ notificationPrefs: next });
      if (key === 'checkInEnding') {
        await syncCheckInEndingNotice(value ? checkIn?.expiresAt ?? null : null);
      }
    } catch {
      setPrefs(prefs);
    }
  };

  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
        <Group theme={theme} footer={t('settings.lockScreenFooter')}>
          <SwitchRow
            title={t('settings.newShyText')}
            subtitle={t('settings.newShyTextSub')}
            value={prefs.shytexts}
            onValueChange={(value) => void setPref('shytexts', value)}
            theme={theme}
          />
          <SwitchRow
            title={t('settings.theyAccepted')}
            subtitle={t('settings.theyAcceptedSub')}
            value={prefs.accepted}
            onValueChange={(value) => void setPref('accepted', value)}
            theme={theme}
          />
          <SwitchRow
            title={t('settings.checkInEnding')}
            subtitle={t('settings.checkInEndingSub')}
            value={prefs.checkInEnding}
            onValueChange={(value) => void setPref('checkInEnding', value)}
            theme={theme}
            last
          />
        </Group>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16 },
});
