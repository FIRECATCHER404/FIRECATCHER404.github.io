# FIRECATCHER404.github.io

Static site published through GitHub Pages. The Firebase-backed messenger lives at `message.html`.

## Messenger backend deployment

The messenger uses Firebase Realtime Database for chat state and read markers, plus Cloud Storage for authenticated file attachments. From this repository root:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only database,storage --project website-11b5c
gcloud storage buckets update gs://website-11b5c.firebasestorage.app --cors-file=storage.cors.json
```

The final command allows browser uploads and authenticated downloads from the GitHub Pages origin and the two local test origins listed in `storage.cors.json`. It requires the Google Cloud CLI and a project account with permission to update the bucket.

Rules can be compiled locally without live credentials:

```powershell
npx firebase-tools emulators:exec --only database,storage --project demo-website-11b5c 'node -p 1'
```
