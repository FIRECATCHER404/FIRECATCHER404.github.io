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
  console.log('Usage: npm run delete-post -- <postId> --confirm <postId>');
}

const args = process.argv.slice(2);
const postId = (args[0] || '').trim();
const confirmFlag = args[1];
const confirmValue = (args[2] || '').trim();

if (!postId || confirmFlag !== '--confirm' || !confirmValue) {
  printUsage();
  process.exit(1);
}

if (confirmValue !== postId) {
  console.error('Confirmation does not match postId. Refusing delete.');
  process.exit(1);
}

const db = initAdmin();
const postRef = db.ref(`posts/${postId}`);
const existingSnapshot = await postRef.get();

if (!existingSnapshot.exists()) {
  console.error(`Post not found: ${postId}`);
  process.exit(1);
}

await postRef.remove();
console.log(`Deleted post: ${postId}`);
