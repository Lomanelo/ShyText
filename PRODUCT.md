# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

People already at a café, bar, campus, or similar venue who want a low-pressure way to become approachable. Inferred from the repo and prior product brief; not a new interview.

## Product Purpose

A ShyText means: I’m here, I’m open to being approached, and this is what I’m up for. People at the same real-world place become temporarily visible with a vibe, optional message, and a short lifetime. Someone can break the ice. Chat starts only if the other person accepts. Success is a consented conversation, not a match graph.

## Positioning

Being at a venue is not visibility. Exact GPS is never shown. Visibility is time-boxed and explicit. Not dating, not a people map, not a feed of silent check-ins.

## Operating Context

Expo SDK 57, Expo Router, EAS development/preview/production clients (`com.rahimrady.myshytext`). Firebase Auth + Firestore. Windows-first development against physical devices. Not Expo Go.

## Capabilities and Constraints

Auth: mobile phone number + SMS verification only. Venue list from Apple Maps Server API (via a server proxy) or demo venues in development. One active ShyText per user. Vibes: Chat, Drink, Coffee, Play, Study, Network, Flirt, Other. Optional message max 120. Default lifetime 30 minutes (15m / 30m / 1h). Chat survives expiry. Block/report exist. No Shy Mode, swipe, followers, or background location.

## Brand Commitments

Name: shytext (wordmark lowercase). Voice: calm, private, in-person. Existing palette is terracotta on warm paper. Do not invent testimonials or live venue counts of silent people.

## Evidence on Hand

Demo venue “Paddy’s Corner” and seed people (Sarah, Adam, Marie) exist only when DEV tools are on. No real user photography or marketing claims.

## Product Principles

1. Invisible until the user taps Drop a ShyText.
2. Approach, don’t broadcast: one person, one icebreaker, one accept.
3. Location is a venue name, never a pin.
4. Safety and quiet defaults beat growth mechanics.

## Accessibility & Inclusion

17+ age gate on optional profile age. Tap targets should stay at least 44pt. Support light and dark system appearance.
