import fs from 'node:fs';
import process from 'node:process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountPath) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT env var (path to service account JSON).');
  process.exit(1);
}

if (!process.env.FIREBASE_DATABASE_URL) {
  console.error('Missing FIREBASE_DATABASE_URL env var.');
  process.exit(1);
}

const raw = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(raw);

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = getDatabase();

const [, , title, author, body] = process.argv;
if (!title || !author || !body) {
  console.error('Usage: npm run publish -- "Title" "Author" "Body text"');
  process.exit(1);
}

const now = new Date().toISOString();
const post = {
  title,
  author,
  body,
  excerpt: body.replace(/\s+/g, ' ').slice(0, 180),
  published: true,
  publishedAt: now,
  createdAt: now
};

const ref = db.ref('posts').push();
await ref.set(post);

console.log(`Published post: ${ref.key}`);