# Modern Firebase Blog (GitHub Pages)

A sleek static blog with dark/light toggle, backed by Firebase Realtime Database.
No template presets and no seed posts are included.

## Security model

- Public site can **read only published posts**.
- Public site can **never write** posts.
- Publishing is blocked in the frontend by design.
- Secure publishing path is a private admin script using Firebase Admin SDK + service account credentials.

## Files

- `index.html`: blog UI
- `styles.css`: modern responsive styling + dark/light theme tokens
- `app.js`: Firebase read logic + theme toggle
- `firebase.rules.json`: strict database security rules
- `scripts/publish-post.mjs`: secure post publishing script (private use)

## Firebase database rules

1. Open Firebase Console > Realtime Database > Rules
2. Replace rules with the contents of `firebase.rules.json`
3. Publish rules

## Data shape

Posts are stored as `/posts/{postId}`:

```json
{
  "title": "My Post",
  "author": "Your Name",
  "excerpt": "Optional short summary",
  "body": "Full post content",
  "published": true,
  "publishedAt": "2026-02-21T18:00:00.000Z",
  "createdAt": "2026-02-21T17:55:00.000Z"
}
```

Only posts with `published: true` are shown publicly.

## Secure publishing (recommended)

1. Create a Firebase service account key (Admin SDK).
2. Keep it local and private, never commit it.
3. Install dependencies:

```powershell
npm install
```

4. Set env vars:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT="C:\path\to\serviceAccountKey.json"
$env:FIREBASE_DATABASE_URL="https://website-11b5c-default-rtdb.firebaseio.com"
```

5. Publish:

```powershell
npm run publish -- "Post Title" "Author" "Post body text"
```

## GitHub Pages deploy

1. Push this folder to a GitHub repository.
2. In GitHub repo settings, open **Pages**.
3. Source: Deploy from branch.
4. Branch: `main` (or your default), folder: `/ (root)`.
5. Save and wait for the URL.

## Local preview

```powershell
python -m http.server 5500
```

Open `http://localhost:5500`.