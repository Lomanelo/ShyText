/**
 * Ensures EXPO_PUBLIC_* from `.env` are available to Metro and baked into
 * `extra` for native builds. Restart Metro after changing `.env`.
 */
const appJson = require('./app.json');

module.exports = () => {
  const expo = { ...appJson.expo };
  expo.extra = {
    ...(expo.extra || {}),
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'auth.shytext.com',
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
    },
  };
  return { expo };
};
