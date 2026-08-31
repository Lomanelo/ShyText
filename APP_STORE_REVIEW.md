# App Store / Play review notes

Use this when submitting via EAS / App Store Connect.

## What this app is

ShyText is a **Social Networking** venue icebreaker. People check into a place, leave a 140-character note that expires in 60 minutes, and reply in private chat. It is **not** a dating app and has **no** public social feed.

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

1. Create or use the demo account below.
2. On **Here**, tap **Open App Review Café** (or enter code `app-review-cafe`).
3. Sample notes appear if the café is empty. Leave your own note.
4. Ghost Mode is in the Here header and on You.
5. Account deletion is You → Account Settings → Delete Account.

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
