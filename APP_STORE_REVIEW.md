# App Store / Play review notes

Use this when submitting via EAS / App Store Connect.

## What this app is

ShyText is a **Social Networking** venue check-in. People check into a place, send a short ShyText to someone else checked in there, and chat only if they accept. It is **not** a dating app and has **no** public social feed.

## Age rating answers (September 2026 questionnaire)

- User-Generated Content: Yes
- Messaging and Chat: Yes
- Social Media (feed / amplify UGC to many users): **No**
- Social Media disabled under 13: do **not** claim this
- Age: **17+**
- Unrestricted Web Access: No

## Guideline 1.2 checklist

- Content filter: `src/lib/moderation.ts` on notes and messages
- Report: note cards, chat header flag, reports stored + emailed via `/api/report`
- Block: chat lock icon; blocked authors are hidden from Here
- Contact: shytext.info@gmail.com and Help & Support in You

## Demo for reviewers

1. Sign in with a test phone number.
2. On **Nearby**, open a venue (tap) then **Check in** (or long-press the place).
3. Sample people appear at the demo venue if DEV tools are on. Send a ShyText to a real second test account.
4. Accept from **Chats → Requests**.
5. Account deletion is Profile → Settings.

### Demo account

Add Firebase **test phone numbers** (Authentication → Sign-in method → Phone → Phone numbers for testing) before submit. Put the numbers and codes in App Review notes; do not commit them here.

A second test number lets reviewers try reply + chat.

## Windows / TestFlight path

```
npm install
npx expo start
npx expo start --android
npx expo start --web
npx eas build --platform ios --profile preview
npx eas submit --platform ios --profile production
```

Publish database rules from `database-rules.json` and Storage rules from `storage.rules` in the Firebase console before TestFlight.

Set Netlify env `FIREBASE_DATABASE_SECRET` (or migrate to a service account) so `/api/notify` can send Expo push without exposing tokens on profiles.
