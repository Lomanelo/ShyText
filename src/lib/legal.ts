export const PRIVACY_POLICY_TEXT = `Last updated: September 21, 2026

ShyText is a venue check-in app operated by an independent developer (hello@shytext.com). It helps people check into a place they are in, send a short ShyText to someone else checked in there, and chat privately if they accept. It is not a dating app and does not show a public social feed.

1. Data we collect
- Account: mobile phone number (for sign-in and verification only — other people never see it), first name, optional profile photo.
- Venue presence: a venue name and coarse geohash while you are checked in. We do not share your precise coordinates with other users.
- Notes and messages you write.
- Reports you submit about other users.
- Device push token so we can deliver message notifications.
- Support messages you send through Help & Support.

2. How we use it
We use this data to run check-in, ShyTexts, chat, safety (block/report), and account deletion. Precise location is used only on-device to confirm you are at a venue.

3. What other people see
People checked into the same venue can see your first name, photo, and vibe after they check in too. Messages are visible only to the two participants.

4. Notifications and Lock Screen
- New ShyText request notifications do not include the note text (open the app to read it).
- Ongoing chat notifications may show a short message preview on the lock screen.
- On iOS, while you are Shyned, a Live Activity may show the venue name on the Lock Screen and Dynamic Island until you Shy Out or the Shyne expires. You can dismiss it from the Lock Screen or by ending your Shyne in the app.

5. Storage and processors
Data is stored in Firebase (Google): Authentication, Cloud Firestore, and Storage, primarily in the United States. Expo is used to build and deliver the app.

6. Retention
Shyne presence uses a rolling idle window of about 30 minutes while you stay active. Account deletion removes your profile, private profile data, device push token, avatar, and active Shyne. Existing chats may remain visible to the other participant with your profile shown as deleted. We may keep reports for safety review.

7. Your rights
You can access, correct, or delete your account in the app (You → Account Settings → Delete Account). You may also email hello@shytext.com. GDPR and CCPA rights apply where those laws do.

8. Children
ShyText is 18+. We do not knowingly collect data from anyone under 18.

9. Contact
hello@shytext.com`;

export const COMMUNITY_GUIDELINES_TEXT = `Last updated: September 21, 2026

ShyText is for adults (18+) who want a low-pressure way to say hi at a place they are already in. These guidelines keep the room safe.

1. Be respectful
No harassment, hate, threats, stalking, or unwanted sexual content. A ShyText is an invitation, not an obligation — accept "no" and move on.

2. No exploitation
Do not solicit nudes, money, or personal data. Do not impersonate someone else. Do not share another person's private information.

3. Stay real
You must be physically at the venue when you Shyne. Fake presence, spam, or bots are not allowed.

4. Meet carefully
If you meet in person, choose public spaces and trust your judgment. ShyText does not arrange meetings and is not responsible for what happens offline.

5. Reporting
Use Report and Block in the app. We review reports sent to hello@shytext.com and may suspend or delete accounts that break these rules or the law.

6. Age
ShyText is 18+. If you believe someone under 18 is using the app, report them immediately.

Contact: hello@shytext.com`;

export const TERMS_OF_SERVICE_TEXT = `Last updated: September 17, 2026

By using ShyText you agree to these terms.

1. The service
ShyText lets people 18 or older check into a venue and send a short ShyText to someone else checked in there. Chat starts only if they accept. It is not a dating, hookup, or anonymous chat service.

2. Accounts
You must be at least 18. Accounts are created with a mobile phone number and SMS verification. You are responsible for activity on your account. You may delete your account in the app at any time.

3. Conduct
Do not harass, threaten, impersonate, spam, solicit sex, share others' private information, or use the app for illegal activity. We may remove content and accounts that break these rules.

4. Safety
You can block and report users. We review reports at hello@shytext.com. We are not responsible for other users' conduct, including if you choose to meet in person. Meet in public and use your judgment.

5. Content
You own your notes and messages. You grant us a limited license to host and deliver them so the product works. Private chats can continue after a Shyne ends. Do not post anything you do not have the right to share.

6. Location
Location is used in the foreground to match you to nearby venues and to confirm you are still there. We never show your exact GPS to other users.

7. Disclaimer
The service is provided as-is. We do not guarantee that someone will be at a venue or that a note will receive a reply.

8. Contact
hello@shytext.com`;
