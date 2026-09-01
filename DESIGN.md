# Design

<!-- impeccable:design-schema 1 -->

## Platform

adaptive

## Mode

Operate

## World

Disposable-camera / door-stamp at a real venue. Dim-bar scene, not a dating deck and not iOS Settings dressed as an app. System grouped backgrounds and labels. One brand tint: flame `#D05927` from the mark. System type for UI; lowercase **shytext** wordmark. Tabular TTL as fading stamp time. No Georgia, no cream-paper feed, no swipe-to-like, no glass decoration.

## Tokens

Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 (`theme/space`)
Radius: 12 / 16 / 24 / pill, `borderCurve: continuous` (`theme/radius`)
Type: iOS text styles — display 34/700, title 22/600, headline 17/600, body 17/400, caption 13/400
Signature: flame mark + lowercase shytext wordmark; flame tint on actions, live dots, and selected tabs
Accent: `#D05927`. Surfaces: `systemGroupedBackground` / Material dynamic background. Cards: secondary grouped / surfaceContainer
Elevation: `boxShadow` 0 10 28 (light) / 0 12 32 (dark)
Motion: interruptible spring press (0.96), hold fill tracks the finger (~720ms) then a short squash, layout spring when the live dock / you’re-here card / chat bubbles move. Live dots beat. OTP slots pop on fill. Story bars fill left-to-right. Lists skip enter. Honor Reduce Motion (hold becomes tap). Reopen checkout notice drops in from the top, then out.

## Components

Primary actions: 54pt pill, press scale 0.96, selection haptic, `onAccent` white. Secondary is a filled card pill.
Check-in: hold-to-confirm fill (~720ms) with haptic ticks; Reduce Motion falls back to tap. Hold control is a pill.
Venue cards: matchbook painting by place type (bar, café, park, door) on cream stock — no map crop, no clip-art icons, no geometric stand-ins. Rubber-stamp type label in rust. Distance chip, live as flame dots. Tap opens the place; long-press (~380ms) starts check-in.
People: only after you check in here; mood chips update live; Other opens a 40-character status; swipe left to send (button remains); Send a ShyText is a bottom sheet, never a silent skip. Reopening more than 100 m from the venue auto-checks you out with a drop-in notice.
OTP: six tall slots, number pad, SMS autofill. Phone number is display-size type beside a country chip.
Onboarding: two skippable beats with story bars, then phone
Loading: pulse skeletons, not static blocks
Timers: tabular-nums; pulse when under 5 minutes
Tabs: system tab bar, outline idle / fill selected, flame tint, light haptic on tab press
Empty states: title + optional body + optional CTA
Settings: grouped inset rows with chevron. Edit profile is one screen — photo (library, square crop, replace, remove), name, bio with count, header Save. Notifications are three switches. Delete account is a confirm-then-wipe row in Settings.
Navigation: native stack headers; edge-swipe back stays alive
Keyboards: phone pad / OTP / search / send; profile fields chain next → done
Chat: iMessage-style bubbles; pill composer with circular send. Incoming ShyTexts sit at the top of Chats, threads below. One hour to send, then the thread stays with a go-talk-in-person note.
