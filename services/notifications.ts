import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEFAULT_NOTIFICATION_PREFS } from '../types/user';
import i18n from '../i18n';

const CHECK_IN_ENDING_ID = 'check-in-ending';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

export type PushKind = 'shytexts' | 'accepted';

export async function registerPushToken() {
  if (Platform.OS === 'web') return;
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const user = auth.currentUser;
  if (user && token) {
    await updateDoc(doc(db, 'users', user.uid), {
      expoPushToken: token,
      language: i18n.language,
    }).catch(() => undefined);
  }
}

export async function notifyUser(
  userId: string,
  payload: { titleKey: 'push.shytextTitle' | 'push.acceptedTitle'; bodyKey: 'push.openToRead' | 'push.acceptedBody' },
  kind: PushKind = 'shytexts'
) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    const data = snap.data();
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...data?.notificationPrefs };
    if (!prefs[kind]) return;
    const token = data?.expoPushToken;
    if (!token) return;
    const lang = typeof data?.language === 'string' ? data.language : 'en';
    const t = i18n.getFixedT(lang);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: t(payload.titleKey),
        body: t(payload.bodyKey),
      }),
    });
  } catch {
    // Push is best-effort in MVP.
  }
}

export async function syncCheckInEndingNotice(expiresAt?: number | null) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(CHECK_IN_ENDING_ID).catch(() => undefined);
  if (!expiresAt || expiresAt <= Date.now()) return;
  const user = auth.currentUser;
  if (!user) return;
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...snap?.data()?.notificationPrefs };
  if (!prefs.checkInEnding) return;
  const fireAt = expiresAt - 5 * 60 * 1000;
  if (fireAt <= Date.now() + 10_000) return;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    identifier: CHECK_IN_ENDING_ID,
    content: {
      title: i18n.t('push.endingTitle'),
      body: i18n.t('push.endingBody'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(fireAt),
    },
  });
}
