import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEFAULT_NOTIFICATION_PREFS } from '../types/user';
import { getOpenChatId } from './openChat';
import i18n from '../i18n';

const CHECK_IN_ENDING_ID = 'check-in-ending';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data ?? {};
    const chatId = typeof data.chatId === 'string' ? data.chatId : undefined;
    const kind = typeof data.kind === 'string' ? data.kind : undefined;
    // Instagram-style: suppress only while already looking at that thread.
    const viewingThisChat = Boolean(chatId) && chatId === getOpenChatId();
    const show = !(kind === 'chats' && viewingThisChat);

    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
      shouldShowAlert: show,
    };
  },
});

export type PushKind = 'shytexts' | 'accepted' | 'chats';

type PushPayload = {
  titleKey: 'push.shytextTitle' | 'push.acceptedTitle' | 'push.chatTitle';
  /** Localized body key for requests / accept. Chat messages use bodyText instead. */
  bodyKey?: 'push.openToRead' | 'push.acceptedBody' | 'push.chatBody';
  /** Raw message preview for ongoing chat notifications (Instagram-style). */
  bodyText?: string;
  titleParams?: Record<string, string>;
  bodyParams?: Record<string, string>;
  data?: Record<string, string>;
};

export async function registerPushToken() {
  if (Platform.OS === 'web') return;
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
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

export async function notifyUser(userId: string, payload: PushPayload, kind: PushKind = 'shytexts') {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    const data = snap.data();
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...data?.notificationPrefs };
    if (!prefs[kind]) return;
    const token = data?.expoPushToken;
    if (!token) return;
    const lang = typeof data?.language === 'string' ? data.language : 'en';
    const t = i18n.getFixedT(lang);
    const body =
      payload.bodyText?.trim() ||
      (payload.bodyKey ? t(payload.bodyKey, payload.bodyParams) : t('push.openToRead'));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        channelId: kind === 'chats' ? 'chat' : 'default',
        title: t(payload.titleKey, payload.titleParams),
        body,
        data: { kind, ...(payload.data ?? {}) },
      }),
    });
  } catch {
    // Push is best-effort in MVP.
  }
}

let lastOpenedResponseId: string | undefined;

export function listenNotificationTaps() {
  const openFromResponse = (response: Notifications.NotificationResponse | null | undefined) => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (id === lastOpenedResponseId) return;
    lastOpenedResponseId = id;
    const data = response.notification.request.content.data ?? {};
    const chatId = data.chatId;
    if (typeof chatId === 'string' && chatId.length > 0) {
      router.push(`/chat/${chatId}`);
      return;
    }
    if (data.kind === 'shytexts' || data.kind === 'accepted') {
      router.push('/(tabs)/chats');
    }
  };

  void Notifications.getLastNotificationResponseAsync().then(openFromResponse);

  return Notifications.addNotificationResponseReceivedListener(openFromResponse);
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
