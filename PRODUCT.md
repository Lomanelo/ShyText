# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

People already at a café, bar, campus, or similar venue who want a low-pressure way to become approachable. Inferred from the repo and prior product brief; not a new interview.

## Product Purpose

Checking in means: I’m here, and I’m open to being approached. A ShyText is a directed note to one other person who is also checked in at this venue. They accept → chat. Success is a consented conversation, not a match graph.

## Positioning

Being at a venue is not visibility. Opening a place is looking, not opting in. Exact GPS is never shown. Visibility is time-boxed and explicit. Not dating, not a people map, not a public board of notes.

## Operating Context

Expo SDK 57, Expo Router, EAS development/preview/production clients (`com.rahimrady.myshytext`). Firebase Auth + Firestore. Windows-first development against physical devices. Not Expo Go.

## Capabilities and Constraints

Auth: mobile phone number + SMS verification only. Venue list from Apple Maps Server API via a server proxy. One active check-in per user. Both sender and receiver must have a live check-in at the same venue to send a ShyText. Vibes: Chat, Drink, Coffee, Play, Study, Network, Flirt, Other. Optional ShyText line max 120. Default check-in 30 minutes (15m / 30m / 1h). Chat survives expiry. Block/report exist. No Shy Mode, swipe-to-like, followers, or background location. Demo venues and seed people are off unless EXPO_PUBLIC_DEV_MODE is explicitly true.

## Brand Commitments

Name: shytext (wordmark lowercase). Voice: calm, private, in-person. Existing palette is terracotta on warm paper. Do not invent testimonials or live venue counts of silent people.

## Evidence on Hand

Demo venue “Paddy’s Corner” and seed people (Sarah, Adam, Marie) exist only when DEV tools are on. No real user photography or marketing claims.

## Product Principles

1. Invisible until the user holds to check in.
2. One place at a time. Mood can change after you’re in.
3. Approach, don’t broadcast: one person, one ShyText, one accept.
4. Location is a venue name, never a pin.
5. Safety and quiet defaults beat growth mechanics.

## Accessibility & Inclusion

17+ age gate on optional profile age. Tap targets should stay at least 44pt. Support light and dark system appearance.
