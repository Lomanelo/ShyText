# ShyText MVP setup

Venue check-in. People at the same place become visible only after they check in. You send a ShyText to one person. Chat starts only if they accept. Exact GPS is never shown to other users.

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
2. Enable **Authentication → Phone** (SMS). Optionally add test phone numbers for local work. Real SMS requires the Blaze plan. Do not use Google, Apple, or email for sign-in in the app.
3. Enable **Cloud Firestore** (this MVP uses Firestore, not Realtime Database).
4. Enable **Storage** only if you add profile photos later.
5. Deploy rules and indexes:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

6. Phone auth uses a reCAPTCHA page at `https://myshytext.firebaseapp.com/phone-recaptcha.html`. Deploy it with `npx firebase deploy --only hosting --project myshytext`.

## 4. Environment variables

Client (`.env` / EAS env):

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_PLACES_PROXY_URL` (example: `https://your-site.netlify.app/api/places`)
- `EXPO_PUBLIC_VENUE_IMAGE_PROXY_URL` (optional; defaults to same Netlify host as places)
- `EXPO_PUBLIC_PHONE_RECAPTCHA_URL` (optional; defaults to Firebase Hosting)
- `EXPO_PUBLIC_DEV_MODE`

Server / Netlify secrets (never ship in the app):

- `GOOGLE_MAPS_API_KEY` (Places API New + Street View Static/Metadata; server only)
- `APPLE_MAPS_TEAM_ID` (optional legacy; no longer used for discovery)
- `APPLE_MAPS_KEY_ID`
- `APPLE_MAPS_PRIVATE_KEY` (Maps `.p8` key contents; `\n` escaped is fine)

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

## 8. Google Places venue discovery

Nearby / search go through `netlify/functions/places.ts` (`/api/places`) using **Places API (New)**.

1. In Google Cloud, enable **Places API (New)** on the same project as Street View.
2. Restrict the key to Places API (New) + Street View Static/Metadata.
3. Set Netlify env: `GOOGLE_MAPS_API_KEY`.
4. Deploy Netlify functions.
5. Keep `EXPO_PUBLIC_PLACES_PROXY_URL` pointing at `https://your-site.netlify.app/api/places`.

Only places with `businessStatus: OPERATIONAL` (or no status, e.g. some parks) are returned, within 100 m.

### Cost (as of Google’s 2025+ SKUs)

- **Nearby Search Pro**: ~5,000 free calls/month, then about **$32 / 1,000**
- **Text Search Pro** (typed search): same ballpark as Nearby Pro
- Street View Static remains separate (~10k free images/month)

At early usage (a few hundred nearby refreshes/month) you should stay inside the free Nearby quota. Cache on the function (90s) and client (45s) reduces billable calls.

Do not put Google keys in `EXPO_PUBLIC_*` variables.

If the proxy is missing, the app uses demo venues (Paddy's Corner, Campus Library, Riverside Park). There is no map UI — only a list of venue names.

## 8b. Google Street View venue photos

Venue cards and the venue hero try a Street View exterior photo before falling back to category stamps.

Flow: `VenueStamp` → `/api/venue-image` → free metadata check → Static API image streamed to the app (not stored on Netlify).

1. In Google Cloud, enable **Street View Static API** and **Street View Metadata API** on the same project/key.
2. Set Netlify env: `GOOGLE_MAPS_API_KEY`.
3. Deploy Netlify functions (`venue-image.ts` at `/api/venue-image`).
4. If `EXPO_PUBLIC_PLACES_PROXY_URL` is already set, images use the same host automatically. Or set `EXPO_PUBLIC_VENUE_IMAGE_PROXY_URL` explicitly.

Query tuning (optional, for testing): `heading`, `fov`, `pitch`, `radius`, `address`. Metadata-only: `?meta=1`.

Google policy: do not persistently cache or rehost Street View imagery. The proxy uses `Cache-Control: no-store` and streams on demand.

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
- Rate limits (1 active ShyText, 10/hour, 20 hellos/hour) are enforced in the client SDK plus rules; a function can harden this further.
- Demo check-in distance bypass is development/preview only.
- Chat is text only.
- Venue coordinates may be stored for proximity checks; they are never shown as another user's location.
- Old Realtime Database data is not used by this MVP.

## 12. MVP test

On two phones, with Firestore enabled:

1. User A creates an account, allows location, checks into a venue (or Paddy's Corner in DEV mode).
2. A is still invisible. A taps Go visible, chooses Coffee, optional message, 30 min.
3. User B checks into the same venue and sees A (profile + intent + message).
4. B taps Say hi and sends an optional intro.
5. A opens Chats → Requests, accepts.
6. Both chat in realtime.
7. A stops visibility or the ShyText expires. A disappears from the venue; the private chat remains.
8. Neither user ever sees the other's GPS. Checked-in invisible users never appear.
