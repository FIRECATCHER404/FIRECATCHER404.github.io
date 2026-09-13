# FIRECATCHER404.github.io

Static site published through GitHub Pages. The Firebase-backed messenger lives at `message.html`.

## Messenger backend deployment

The messenger uses Firebase Realtime Database for chat state, read markers, and authenticated on-demand file attachments. The attachment limit is intentionally 1 MB per file (up to three files per message) so the feature works on Firebase's no-cost plan without a Cloud Storage bucket. From this repository root:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only database --project website-11b5c
```

Attachment contents live outside message records under `secureChat/attachmentData`, so ordinary message listeners do not download files. Files are fetched only when opened (except visible image previews), and message creation plus attachment storage is one atomic database update.

Rules can be compiled locally without live credentials:

```powershell
npx firebase-tools emulators:exec --only database --project demo-website-11b5c 'node -p 1'
```
