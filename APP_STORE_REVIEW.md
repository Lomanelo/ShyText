# App Store / Play review notes

Use this when submitting via EAS / App Store Connect.

## What this app is

ShyText is a **Social Networking** venue check-in. People **Shyne** at a place, send a short ShyText to someone else who Shyned there, and chat only if they accept. It is **not** a dating app and has **no** public social feed or people map.

## Age rating answers (September 2026 questionnaire)

- User-Generated Content: Yes
- Messaging and Chat: Yes
- Social Media (feed / amplify UGC to many users): **No**
- Social Media disabled under 13: do **not** claim this
- Age: **18+**
- Unrestricted Web Access: No

## Guideline 1.2 checklist

- Content filter: client `services/moderation.ts` + Netlify `/api/moderate` and `/api/messages`
- Report: venue cards, chat header → Firestore `reports` + email via Netlify `/api/report` to **hello@shytext.com**
- Block: chat menu; blocked users are hidden at venues
- Community Guidelines: in-app **Settings → Community Guidelines** (`/legal/guidelines`)
- Contact: **Help & Support** on Profile and Settings → `mailto:hello@shytext.com`
- Report triage: monitor `hello@shytext.com` daily; suspend via Firebase Console (`users/{uid}.status = suspended`)

## Product facts (keep notes in sync)

- Venue discovery: **Serper** via Netlify `/api/places` (Firebase Auth required + rate limits)
- Venue images: `/api/venue-image` (Auth required; Image uses `idToken` query)
- Presence: **Shyne** with a rolling **30-minute** idle window + heartbeat
- Notifications (Settings): New ShyText, They accepted, Chat messages, Shyne ending, Someone Shynes here
- Push: client calls `/api/notify` (peer-gated); Expo push token on `users/{uid}/private/device`
- Auth: **Phone SMS only** (native Firebase Auth + APNs for branded SMS)
- App Check + Crashlytics: enabled in production native builds

## Demo for reviewers

1. Sign in with a test phone number.
2. On **Nearby**, open a venue then **Shyne**.
3. Use a second test account at the same venue. Send a ShyText.
4. Accept from **Chats → Requests**.
5. Account deletion is Profile → Settings → Delete account.
6. Help & Support is Profile → Help & Support (or Settings).
7. Community Guidelines is Settings → Community Guidelines.

### Demo account

Add Firebase **test phone numbers** (Authentication → Sign-in method → Phone → Phone numbers for testing) before submit. Put the numbers and codes in App Review notes; do not commit them here.

A second test number lets reviewers try reply + chat.

## Privacy Nutrition Labels (ASC)

Declare (linked, not used for tracking):

- Phone Number — App Functionality (sign-in)
- Precise Location — App Functionality (when in use; venue match only)
- Photos — App Functionality (avatar)
- Device ID / Push token — App Functionality (notifications)
- Crash Data — App Functionality (Crashlytics)
- User Content (messages / notes) — App Functionality

## Billing alerts (set before worldwide launch)

- Serper dashboard budget / spend alert
- Firebase Authentication SMS quota alert
- Google Cloud billing budget on project `myshytext`
- Resend spend alert
- Expo / EAS account billing email alerts
- Netlify bandwidth / function invocations alert

## Windows / TestFlight path

```
npm install
npx expo start --dev-client
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production
```

Publish Firestore rules from `firestore.rules` and Storage rules from `storage.rules` before TestFlight (redeploy after every rules change).

Enable Firebase App Check providers: **App Attest / DeviceCheck** (iOS) and **Play Integrity** (Android). Register debug tokens for internal builds only.

### Netlify secrets for push + report email + places

- `FIREBASE_SERVICE_ACCOUNT` — JSON service account with Firestore read/write (notify peer checks + `/api/messages`)
- `FIREBASE_WEB_API_KEY` — same as client web API key (verify ID tokens)
- `RESEND_API_KEY` — email reports to `REPORT_INBOX` (default `hello@shytext.com`)
- `REPORT_FROM` — verified Resend from-address (optional)
- `SERPER_API_KEY` — venue discovery

Set `EXPO_PUBLIC_API_BASE` to your Netlify site (EAS already uses `https://shytextapi.netlify.app`).

### EAS env (production)

All `EXPO_PUBLIC_FIREBASE_*` keys must be set in EAS secrets — the app refuses hardcoded Firebase fallbacks.
