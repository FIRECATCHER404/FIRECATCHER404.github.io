# FIRECATCHER404.github.io

Static site published through GitHub Pages. The Firebase-backed messenger lives at `message.html`.

## Expressionful Skin Studio

Open [Skin Studio](https://firecatcher404.github.io/projects/skin-studio/) to create animated Minecraft skin packs. It runs entirely in your browser with a dark interface, 3D player preview, frame uploads, rule builder, ZIP import/export, and a draft stored on your device. No server setup or account is required.

Its static files live in `projects/skin-studio/`, including vendored MIT-licensed fflate and skinview3d libraries and the Expressionful 1.2.0 mod download. No uploaded skins or drafts are sent to a backend. Export a ZIP to back up your work or move it between browsers.

## Messenger backend deployment

The messenger uses Firebase Authentication and Realtime Database for groups, friends, direct messages, read markers, and authenticated on-demand file attachments. The attachment limit is intentionally 1 MB per file (up to three files per message) so the feature works on Firebase's no-cost plan without a Cloud Storage bucket. Oversized JPEG, PNG, and WebP photos up to 12 MB are compressed locally before upload; original files never leave the browser when compression fails.

Private invitation links expire after 1, 7, or 30 days and can be limited to 1, 5, 10, or 25 uses. Use the migration once before deploying the stricter rules to preserve legacy private-group invites:

```powershell
node scripts/migrate-message-invites.mjs
node scripts/migrate-message-invites.mjs --apply
```

Then deploy the database rules:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only database --project website-11b5c
```

Attachment contents live outside message records under `secureChat/attachmentData`, so ordinary message listeners do not download files. Files are fetched only when opened (except visible image previews), and message creation plus attachment storage is one atomic database update.

Rules can be compiled and exercised locally without changing production:

```powershell
npx firebase-tools deploy --only database --dry-run
npx firebase-tools emulators:exec --only auth,database "node scripts/test-message-rules.mjs"
```

The emulator suite verifies friend-request privacy, reciprocal acceptance, friend-only DM creation, two-person DM boundaries, private-message access, invite expiration, and hard invite-use limits.

## App Check setup

The App Check integration is included but intentionally remains off until a site key is configured. Create a free reCAPTCHA v3 site key for `firecatcher404.github.io`, paste it into `appCheckConfig.siteKey` in `message-firebase-config.js`, and push the change. In Firebase Console, register the web app with App Check and monitor valid requests before turning on Realtime Database enforcement. Enabling enforcement before the deployed page is producing valid tokens will block the messenger.

The app also enforces a four-second server-validated cooldown for friend requests and user invitations. App Check adds bot and scripted-client protection once its site key and Firebase enforcement are enabled.
