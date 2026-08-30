import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

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
    await updateDoc(doc(db, 'users', user.uid), { expoPushToken: token }).catch(() => undefined);
  }
}

export async function notifyUser(
  userId: string,
  payload: { title: string; body: string }
) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    const token = snap.data()?.expoPushToken;
    if (!token) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: 'Open ShyText to read it.',
        data: { preview: payload.body },
      }),
    });
  } catch {
    // Push is best-effort in MVP.
  }
}
