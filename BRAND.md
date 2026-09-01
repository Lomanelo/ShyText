# shytext — brand identity (social)

This file is the production bible for Instagram posts, carousels, and Reels. The in-app UI system lives in `DESIGN.md`. Do not mix them: the **app** is native iOS grouped chrome; **social** is mascot-led, matchbook, dim-bar.

Canonical mark: flame `#D05927`. Wordmark: lowercase **shytext**. Mascot source: `assets/images/Mascot.png`. App icon: `assets/images/icon.png`.

---

## 1. What we sell

ShyText is not a dating app. It is a **venue check-in that lets shy people send one note to someone who is actually in the same room**, then pushes them to talk in person after an hour.

The product promise in one line:

> Check in. Send a note. Go talk.

The enemy is every app that keeps you scrolling people who are not here. Tinder, Bumble, “who’s nearby on a map.” We never look like them.

**Audience:** 17–30, out at a bar / café / park, phone in hand, not brave enough to walk over. They already have dating apps. They want a *smaller* door.

**Job of Instagram:** make the mascot famous, make the mechanic obvious in 3 seconds, make “not a dating app” a joke people repeat.

---

## 2. Personality

| We are | We are not |
| --- | --- |
| Quiet, dry, specific | Thirsty, horny, “find your person” |
| A friend at the bar | A coach, a guru, a growth-hack brand |
| Door-stamp / disposable camera | Cream-paper dating diary |
| Flame, small, warm | Fire emoji spam, neon nightlife |
| Lowercase | ALL CAPS STARTUP |

Voice on every caption:

- Short sentences. Periods. Almost no exclamation marks.
- Prefer lowercase in hooks (`shytext isn’t tinder`) unless it is a stamp label (`BAR`, `CAFÉ`).
- Never: soulmate, rizz, sliding into DMs, “the one,” heart-eyes, fire + heart stacks.
- Always: this venue, this hour, this note, then IRL.

Caption sign-off (optional, not every post): `shytext` in lowercase, no hashtag stuffing. 3–5 tags max: `#shytext #notadatingapp` plus one venue-type word.

---

## 3. Mascot lock

Working name: **Flick** (the little flame who texts first so you don’t have to). If the name is wrong, keep calling it **the Flame** — never “the shy guy,” never a human face swap.

Flick is the brand. The icon is the head. The hoodie is the body. The phone is the plot.

### Always true (copy this into every image prompt)

2D vector mascot, clean even black outlines, flat cel fills, no gradients, no 3D, no Pixar, no photoreal skin. Large stylized flame for a head (brand orange `#D05927` / `#E06A3A` highlight), two small black oval eyes, tiny closed-mouth curved smile, no nose, no ears, no hair. Cream oversized hoodie (`#F4EDE3`) with a small orange flame print on the left chest. Black backpack with straps over both shoulders. Muted tan cuffed trousers (`#9A7B5C`). Crisp white sneakers with a tiny orange flame on the outer side. Often holding a dark phone with a small flame on the back. Left hand often in the front kangaroo pocket. Youthful streetwear, urban, slightly introverted, looking at the phone more than at the camera.

Identical original character in every frame. Do not change the hoodie color, do not add a face to the flame, do not turn the head into a realistic fire, do not give it a human skull inside the flame.

### Poses that carry the product

1. Walking, looking down at the phone (hero / profile / default).
2. Peeking over the phone, eyes up, still shy.
3. Holding the phone out like “I sent it.”
4. Standing in a doorway / under a bar neon, backpack on, not talking to anyone.
5. Sitting at a café table, phone face-down — time to talk.
6. Tiny stamp-size Flick in the corner of a carousel slide (end-card only).

### Never

- Dating-app poses (kiss, heart hands, rose, bedroom).
- Gym thirst, sunglasses-on-fire, “sigma” memes.
- Speech bubbles with pickup lines.
- Extra limbs, extra eyes, realistic fire, smoke, sparks everywhere.
- Recoloring the hoodie to black or the flame to yellow.

### Consistency pipeline (Higgsfield)

Flick is a **cartoon character, not a person**. Do **not** train a Soul. Soul is for human identity photos.

1. Upload `assets/images/Mascot.png` via Higgsfield `media_upload` → confirm.
2. Save as a **Reference Element** (`show_reference_elements`, create) named `flick-mascot`.
3. Every still: `generate_image` with that element as the character reference (Nano Banana Pro / GPT Image 2 / Seedream — whatever `models_explore` recommends for “consistent 2D mascot + scene”).
4. First production job after this file: a **turnaround + expression sheet** (Higgsfield workflow `character-sheet`, preset `anime-2d`, custom render: flat vector, black line, no gradient). Front, 3/4, side, back, plus phone-down / phone-up / pocket-hand.
5. Reels: still → video with the sheet or the hero PNG as first frame. Keep motion small (walk cycle, glance at phone, look up). No morphing the head.

KIE fallback for stubborn consistency: Ideogram Character / Character Remix, same lock paragraph, mascot PNG as reference.

---

## 4. Color

One brand tint in the app. Social may use the mascot’s clothes as supporting paints. Never introduce blue, magenta, or dating-app pink.

| Token | Hex | Use |
| --- | --- | --- |
| Flame | `#D05927` | Wordmark, CTAs, flame head, underlines, end-card |
| Flame lift | `#E06A3A` | Specular on the head only; never as a second brand |
| Cream stock | `#F4EDE3` | Default feed background, hoodie, carousel paper |
| Icon cream | `#FCF3E8` | App-icon plate; OK for stories |
| Ink | `#1C120E` | Body type, outlines if not pure black |
| Line | `#2A2A2A` | Mascot outlines, phone, backpack |
| Tan / stamp | `#9A7B5C` | Trousers, rubber-stamp labels, captions on cream |
| Night bar | `#12100E` | Reels, dim-bar scenes, night carousels |
| On-flame | `#FFFFFF` | Type on flame buttons only |
| Flame wash | `rgba(208, 89, 39, 0.14)` | Soft panels, never a full slide fill |

**Feed default:** cream stock + ink type + one flame accent.  
**Reel default:** night bar + practical warm lights + Flick as the only saturated object.  
**Do not** full-bleed flame orange as a background. It fights the head.

Contrast: body text on cream is Ink. Body text on night is Cream. Never grey-on-grey.

---

## 5. Type

App UI stays **system** (SF Pro / Roboto). Instagram is allowed to have a voice.

| Role | Font | Why |
| --- | --- | --- |
| Wordmark | System / **Inter** 700, lowercase `shytext`, tracking +20 | Matches the app. Never restyle the wordmark. |
| Hook (slides 1) | **Satoshi Bold** or **Clash Grotesk Bold**, mostly lowercase, 8–12 words max | Quiet, not a circus poster |
| Body | Satoshi Regular / Inter Regular | Readable at 1080 |
| Stamp / venue chip | **Barlow Condensed** or **Oswald** Medium, ALL CAPS, tracking +80, rust/tan | Door-stamp, matchbook |
| Timer | Tabular nums, Satoshi Bold | The 1-hour chat lock |

Licenses: Satoshi + Clash Grotesk are Fontshare (free for social). Inter is OFL. Barlow / Oswald are Google Fonts.

### Type rules

- One hook per slide. If it needs a subtitle, the hook failed.
- No script fonts. No Georgia. No editorial serif. No Comic Sans-adjacent rounded display.
- Don’t center-align a paragraph. Hooks can center; captions in-feed are left.
- Safe zone: 80 px padding on 1080. Keep type out of Instagram UI (username, icons).
- Reels captions: 6 words on screen, the rest in the spoken/caption field.

---

## 6. Formats

| Surface | Size | Safe |
| --- | --- | --- |
| Feed square | 1080 × 1080 | Center Flick; don’t crop the flame head |
| Portrait post / carousel | 1080 × 1350 | **Default for carousels** |
| Story / Reel | 1080 × 1920 | Keep hook in center third |
| Cover thumb | 1080 × 1920 still, plus 1080 × 1080 crop | Face (eyes) on the upper third |

Carousel: 5–8 slides. Slide 1 is the joke or the tension. Last slide is always: wordmark + one line + no paragraph.

---

## 7. Art direction

**World:** disposable camera, door-stamp, real venue, dim bar. Matchbook paintings already exist in `assets/stamps/*.jpg` — use them as *background texture* behind Flick, never as the subject.

Lighting: warm practicals, tungsten, phone screen glow on the hoodie. No beauty dish, no cyber neon grid, no golden-hour influencer sidewalk.

Camera: slight 35mm / disposable-camera grain is allowed on **scenes**. Keep Flick’s line art crisp — grain on the room, not on the vector.

Composition: Flick is usually 40–70% of frame. Negative cream or dark wood. One object that says venue (stool, espresso cup, matchbook, door). Never a crowd of faces.

---

## 8. Content system (what actually grows this account)

Mascot accounts win on **repeatable bits**, not on product screenshots. Duolingo did not grow by posting the lesson UI. We post Flick’s nights out.

### Pillar A — Silent comedy (40%)

Flick at a venue, failing to talk, succeeding at the note. No UI. One caption.

Examples:

- Flick at the bar, staring at the phone. Caption: `you’re three meters away. that’s the whole app.`
- Flick puts the phone face-down. Caption: `one hour. then go talk.`
- Two flames would be wrong. One Flick. The other person is never shown as a face — a coat on a stool, a second coffee, a door.

### Pillar B — Mechanic carousels (30%)

Teach the product without looking like an App Store preview.

**Carousel recipe — “how shytext works” (7 slides, 1080×1350, cream):**

1. Hook: `you’re at the same place. you still won’t walk over.`
2. Flick holds the phone: `check in. on purpose.`
3. Only people checked in here appear. `not a map of strangers.`
4. Send a ShyText. `one note. not a swipe.`
5. They accept → one hour of chat.
6. Timer ends. `the chat stays. sending stops. go talk.`
7. End card: flame + `shytext` + `check in. send a note. go talk.`

**Carousel recipe — “not a dating app” (6 slides):**

1. `this is not tinder with a map.`
2. No profiles to browse from the couch.
3. No followers, no likes, no comments on people.
4. You are invisible until you check in.
5. Location is a venue name, never a pin on a person.
6. End card.

### Pillar C — Relatable text (20%)

Typographic slides. Flick small in the corner. Cream, ink, one flame rule.

Hooks that fit this product:

- `the bravest thing you did tonight was open the chat.`
- `if they wanted to talk they would. unless they’re also shy.`
- `gps to a person is creepy. a bar name isn’t.`

### Pillar D — Proof / product (10%)

Rare. Real UI only when it earns it. Pull screens from the app or Mobbin-style crops of *our* Nearby / check-in / chat lock. Never fake dating-app chrome.

---

## 9. Reels

Length: 6–12 seconds. Loopable. Sound optional; most Flick bits work silent with large type.

**Reel A — Walk-in:** Flick walks into a bar (night bar palette), looks at phone, check-in stamp hits, cut to black, wordmark.  
**Reel B — The hour:** On-screen tabular timer from `60:00` to `00:00`, Flick puts phone in pocket, looks up. Super: `go talk.`  
**Reel C — Anti-map:** A generic people-map (abstract, not a competitor screenshot) crumples; Flick stands under a venue sign instead.

Motion: walk cycle, phone raise, glance. Honor the app’s feel — interruptible, not bouncy cartoon squash. Reduce Motion version: still + type.

Voiceover: only if it sounds like a friend, not an ad. No “hey guys.” If we use VO, generate it in a dry, close-mic, slightly tired register (KIE ElevenLabs), not a YouTuber.

Music: original bed (KIE Suno, lo-fi bar, no lyrics) or Instagram’s commercial library. Do not steal a trending audio that fights the quiet brand.

---

## 10. Higgsfield production recipes

Always attach Flick as a reference element. Always paste the mascot lock. Always set aspect ratio to the format table.

**Still (feed / carousel slide):**

```
2D vector mascot character sheet consistency, identical original shytext mascot “Flick”: [LOCK PARAGRAPH]. Scene: [venue, time of day, one prop]. Palette: cream #F4EDE3, flame #D05927, ink #1C120E, tan #9A7B5C. Flat even lighting on the character, slight warm practicals on the room. No photoreal skin, no 3D render, no extra characters, no readable UI, no logos except the small chest flame. 1080x1350.
```

**Night Reel still (first frame):**

Same lock, `Night bar #12100E, tungsten practicals, phone screen glow on the cream hoodie, 1080x1920, headroom for Instagram UI.`

**End card:**

Cream field, flame mark from `icon.png` (not a new flame), lowercase shytext in Inter 700 `#D05927`, one line of Satoshi. No tagline stacking.

Negative (every job): `no photoreal, no 3D, no extra fingers, no human face on the flame, no dating app UI, no heart icons, no sparkles, no watermark, no text unless specified.`

---

## 11. Connectors — what we have, what to add

### Already in this Cursor project (use these first)

| Connector | Use for shytext social |
| --- | --- |
| **Higgsfield** | Primary. Stills, Reels, character sheet, reference element, TikTok publish if we cross-post. |
| **KIE** | Backup generation, **character consistency**, 4K upscale, VO (ElevenLabs), original music (Suno). Quote credits before submit. |
| **Mobbin** | Steal *structure* from other apps’ onboarding carousels — not their brand. Never paste Tinder chrome into a post. |
| **Cursor GenerateImage** | Quick throwaways only. Not for Flick (consistency dies). |

Higgsfield also speaks **TikTok** (connect, trending commercial music, publish). Instagram is the home; TikTok is a crop of the same Reel.

### Worth adding next (in this order)

1. **Canva MCP** — `https://mcp.canva.com/mcp`  
   Typeset carousels on-brand after Higgsfield draws Flick. Upload the mascot PNG + this palette into a Brand Kit. Best for 7-slide mechanic posts where type must be perfect. Free plan can generate/export; resize is Pro.

2. **Buffer MCP** — `https://mcp.buffer.com/mcp`  
   Official, free tier. Draft + schedule Instagram (and others) from chat. Media must be a **hosted URL** (Higgsfield/KIE result URL works). Do not auto-publish; create drafts, human taps.

3. **Blotato** (`mcp.blotato.com/mcp`) or **Socialync**  
   If we want one prompt → Instagram + TikTok + Threads. Only after Buffer feels too thin.

4. **Official Instagram Graph MCP** (e.g. `mikusnuz/meta-mcp`, `adelaidasofia/instagram-mcp`)  
   Publish carousels/Reels, read insights. Requires an Instagram **Business/Creator** account + Meta app. Skip until the account is converted. Never use unofficial “login + password” Instagram MCPs — ban risk.

### Do not bother for this brand

- Generic “AI influencer” face tools (we have a mascot).
- Midjourney-only Discord (worse consistency, worse pipeline than Higgsfield + element).
- Later / Hootsuite until Buffer is proven.

### Production loop (the one we actually run)

1. Pick a pillar + recipe from this file.  
2. Higgsfield: generate Flick stills (or first frame).  
3. Canva (or type in-app): set Satoshi/Inter, palette, 1080×1350.  
4. KIE: upscale if soft; Suno/ElevenLabs only if the Reel needs it.  
5. Buffer: draft caption + alt text + schedule.  
6. You: approve. Nothing posts without a human.

---

## 12. Caption + alt text

**Alt text** (every image): `Cartoon flame-headed mascot in a cream hoodie and tan pants, looking at a phone. shytext.`

**Caption formula:** hook (line 1) → one product truth → optional CTA (`link in bio` only when we mean it).

Good:

```
you’re both at the same bar.
shytext is the note you send instead of hovering.

check in. send a note. go talk.
```

Bad:

```
🔥🔥 FIND YOUR PEOPLE 🔥🔥
Swipe culture is DEAD 💀 download NOW!!!
```

---

## 13. Launch set (generate these first)

When we start producing, do this set in order — it trains the model and the audience.

1. Character sheet (turnaround + expressions) — internal, not posted.  
2. Hero still: walking + phone, cream void. Profile pic + highlight cover.  
3. Pillar B carousel: how it works (7).  
4. Pillar A still: bar stool, one caption.  
5. Reel B: the hour.  
6. Pillar B carousel: not a dating app (6).  
7. End-card template (reuse forever).  
8. Highlight covers: flame on cream, one stamp word (`NEARBY`, `CHAT`, `IRL`).

Until (1) exists, do not run a 12-slide campaign — Flick will drift.

---

## 14. Legal / safety on camera

- 17+ product. No school-coded content, no “teen nightlife.”
- No real people’s faces from venues.
- No “we know who’s nearby” energy. Heat is venue activity, not a people map.
- Check-in is opt-in. Copy must never say the app tracks you in the background.

---

## 15. Relationship to the app file

| | `DESIGN.md` | this file |
| --- | --- | --- |
| Surface | iPhone UI | Instagram / Reels / TikTok |
| Type | System | Satoshi + Inter + condensed stamp |
| Color | Flame + semantic system colors | Flame + cream + ink + tan + night |
| Character | Flame mark | Flick, full body |
| Motion | Springs, hold-to-check-in | Walk, glance, timer |

If a social asset starts looking like iOS Settings or like a dating deck, it is wrong. If it looks like a matchbook with a shy flame on a phone, it is right.
