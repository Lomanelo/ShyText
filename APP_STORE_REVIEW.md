# App Store / Play review notes

Use this when submitting via EAS / App Store Connect.

## What this app is

ShyText is a **Social Networking** venue check-in. People **Shyne** at a place, send a short ShyText to someone else who Shyned there, and chat only if they accept. It is **not** a dating app and has **no** public social feed or people map.

## Age rating answers (September 2026 questionnaire)

- User-Generated Content: Yes
- Messaging and Chat: Yes
- Social Media (feed / amplify UGC to many users): **No**
- Social Media disabled under 13: do **not** claim this
- Age: **17+**
- Unrestricted Web Access: No

## Guideline 1.2 checklist

- Content filter: `services/moderation.ts` on notes and messages
- Report: venue cards, chat header → Firestore `reports` + email via Netlify `/api/report` to **hello@shytext.com**
- Block: chat menu; blocked users are hidden at venues
- Contact: **Help & Support** on Profile and Settings → `mailto:hello@shytext.com`

## Product facts (keep notes in sync)

- Venue discovery: **Serper** via Netlify `/api/places` (not Apple Maps in the live path)
- Presence: **Shyne** with a rolling **30-minute** idle window + heartbeat
- Notifications (Settings): New ShyText, They accepted, Chat messages, Shyne ending, Someone Shynes here
- Push: client calls `/api/notify`; Expo push token lives on `users/{uid}/private/device` (not public profile)
- Auth: **Phone SMS only** (native Firebase Auth + APNs for branded SMS)

## Demo for reviewers

1. Sign in with a test phone number.
2. On **Nearby**, open a venue then **Shyne**.
3. Use a second test account at the same venue. Send a ShyText.
4. Accept from **Chats → Requests**.
5. Account deletion is Profile → Settings → Delete account.
6. Help & Support is Profile → Help & Support (or Settings).

### Demo account

Add Firebase **test phone numbers** (Authentication → Sign-in method → Phone → Phone numbers for testing) before submit. Put the numbers and codes in App Review notes; do not commit them here.

A second test number lets reviewers try reply + chat.

## Windows / TestFlight path

```
npm install
npx expo start --dev-client
npx eas build --platform ios --profile preview
npx eas submit --platform ios --profile production
```

Publish Firestore rules from `firestore.rules` and Storage rules from `storage.rules` before TestFlight.

### Netlify secrets for push + report email

- `FIREBASE_SERVICE_ACCOUNT` — JSON service account with Firestore read access (for `/api/notify`)
- `FIREBASE_WEB_API_KEY` — same as client web API key (verify ID tokens)
- `RESEND_API_KEY` — email reports to `REPORT_INBOX` (default `hello@shytext.com`)
- `REPORT_FROM` — verified Resend from-address (optional)
- `SERPER_API_KEY` — venue discovery

Set `EXPO_PUBLIC_API_BASE` to your Netlify site (EAS already uses `https://shytextapi.netlify.app`).
