# ShyText MVP setup

Venue icebreaker. People at the same place leave a short ShyText. Someone can say hello. Chat starts only if the author accepts. Exact GPS is never shown to other users.

## 1. Folder structure

```text
app/                    Expo Router screens
  (auth)/               welcome, sign-in, create-account, profile-setup
  (tabs)/               nearby, chats, profile
  venue/[venueId].tsx
  shytext/              create, [shytextId]
  chat/[chatId].tsx
  requests/index.tsx
  settings/             privacy, blocked-users
components/
hooks/
services/               Firebase, venues, shytexts, chat, places
types/
utils/
firestore.rules
firestore.indexes.json
eas.json
```

## 2. Local setup

```bash
npm install
cp .env.example .env
npx expo start --dev-client
```

This app is **not** designed for Expo Go. Use a development build.

Set `EXPO_PUBLIC_DEV_MODE=true` in `.env` for demo venues (Paddy's Corner) and seeded ShyTexts. This is ignored on a production EAS channel.

## 3. Firebase

1. Open the Firebase project (`myshytext` or a new one).
2. Enable **Authentication**: Apple, Google, and Email/Password (email is for development).
3. Enable **Cloud Firestore** (this MVP uses Firestore, not Realtime Database).
4. Enable **Storage** only if you add profile photos later.
5. Deploy rules and indexes:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

6. Add the same authorized domains / OAuth redirect URIs you already use for `com.rahimrady.myshytext`.

## 4. Environment variables

Client (`.env` / EAS env):

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_PLACES_PROXY_URL` (example: `https://your-site.netlify.app/api/places`)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_DEV_MODE`

Server / EAS secrets (never ship unrestricted):

- `GOOGLE_MAPS_API_KEY` for the Places proxy only
- Apple / Google OAuth client secrets as required by your console

## 5. Firestore collections

- `users`
- `venues`
- `checkins`
- `shytexts`
- `chatRequests`
- `conversations`
- `conversations/{id}/messages`
- `reports`
- `blocks`

## 6. Security rules

See `firestore.rules`. Users can only edit their own profile, post/delete their own ShyTexts, send requests as themselves, and read chats they participate in. There is no `allow read, write: if true`.

## 7. Indexes

See `firestore.indexes.json`. Important composites:

- `shytexts`: `venueId` + `status` + `expiresAt` + `createdAt`
- `chatRequests`: `receiverId` + `status` + `createdAt`
- `conversations`: `participantIds` (array) + `lastMessageAt`

## 8. Google Places

Do not put an unrestricted Places key in the app.

1. Restrict a server key to Places API.
2. Deploy `netlify/functions/places.ts` (path `/api/places`).
3. Set `GOOGLE_MAPS_API_KEY` on Netlify.
4. Set `EXPO_PUBLIC_PLACES_PROXY_URL` to that URL.

If the proxy is missing, the app uses demo venues (Paddy's Corner, Campus Library, Riverside Park).

## 9. iOS development build

```bash
npx eas-cli login
npx eas-cli build --profile development --platform ios
```

Install the build on a device, then:

```bash
npx expo start --dev-client
```

If Apple returns 403, accept the latest Paid Apps / Developer agreements in App Store Connect, then rebuild so credentials can regenerate.

Bundle ID: `com.rahimrady.myshytext`

## 10. Android development build

```bash
npx eas-cli build --profile development --platform android
```

Then `npx expo start --dev-client`.

Package: `com.rahimrady.myshytext`

Preview APK: `--profile preview`.

## 11. Known limitations

- Push is best-effort from the client. A Cloud Function is the right next step.
- Rate limits (3 active ShyTexts, 10/hour, 20 hellos/hour) are enforced in the client SDK plus rules; a function can harden this further.
- Demo check-in distance bypass is development/preview only.
- Chat is text only.
- Venue coordinates may be stored for proximity checks; they are never shown as another user's location.
- Old Realtime Database data is not used by this MVP.

## 12. MVP test

On two phones, with Firestore enabled:

1. User A creates an account, allows location, checks into the same venue (or Paddy's Corner in DEV mode).
2. User A posts: “Anyone want to play dominoes?”
3. The card appears immediately for A.
4. User B checks into the same venue and sees the ShyText.
5. B taps Say hello and sends “I'm in.”
6. A opens Chats → Requests, accepts.
7. Both chat in realtime.
8. After expiry the public ShyText disappears; the private chat remains.
9. Neither user ever sees the other's GPS.
