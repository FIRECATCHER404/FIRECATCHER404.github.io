import fs from 'node:fs';
import process from 'node:process';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} env var.`);
    process.exit(1);
  }
  return value;
}

function initAdmin() {
  const serviceAccountPath = requireEnv('FIREBASE_SERVICE_ACCOUNT');
  const databaseURL = requireEnv('FIREBASE_DATABASE_URL');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL
    });
  }

  return getDatabase();
}

function printUsage() {
  console.log('Usage: npm run edit-post -- <postId> [--title "..."] [--author "..."] [--body "..."] [--published true|false] [--publishAt ISO_DATE]');
}

function parseArgs(argv) {
  const args = [...argv];
  const postId = (args.shift() || '').trim();
  const patch = {};

  while (args.length > 0) {
    const key = args.shift();
    if (!key || !key.startsWith('--')) {
      console.error(`Unexpected argument: ${key || ''}`);
      printUsage();
      process.exit(1);
    }

    const value = args.shift();
    if (value === undefined) {
      console.error(`Missing value for ${key}`);
      process.exit(1);
    }

    switch (key) {
      case '--title':
        patch.title = String(value).trim();
        break;
      case '--author':
        patch.author = String(value).trim();
        break;
      case '--body':
        patch.body = String(value);
        break;
      case '--published':
        if (value !== 'true' && value !== 'false') {
          console.error('--published must be true or false');
          process.exit(1);
        }
        patch.published = value === 'true';
        break;
      case '--publishAt': {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          console.error('--publishAt must be a valid date string');
          process.exit(1);
        }
        patch.publishedAt = parsed.toISOString();
        break;
      }
      default:
        console.error(`Unknown option: ${key}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!postId) {
    console.error('Missing postId.');
    printUsage();
    process.exit(1);
  }

  if (Object.keys(patch).length === 0) {
    console.error('No fields to update.');
    printUsage();
    process.exit(1);
  }

  if (patch.body !== undefined) {
    patch.excerpt = patch.body.replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  patch.updatedAt = new Date().toISOString();

  return { postId, patch };
}

const db = initAdmin();
const { postId, patch } = parseArgs(process.argv.slice(2));

const postRef = db.ref(`posts/${postId}`);
const existingSnapshot = await postRef.get();

if (!existingSnapshot.exists()) {
  console.error(`Post not found: ${postId}`);
  process.exit(1);
}

await postRef.update(patch);
console.log(`Updated post: ${postId}`);
console.log(`Fields: ${Object.keys(patch).join(', ')}`);
