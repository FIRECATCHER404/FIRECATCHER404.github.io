// Firebase client config is public in browser apps. Keep access controlled with
// Firebase Auth, Realtime Database rules, and App Check rather than secrets here.
export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyC4HaUzTDQsz1AKUCsv1ieY5G9WrCyTHrw",
  authDomain: "website-11b5c.firebaseapp.com",
  databaseURL: "https://website-11b5c-default-rtdb.firebaseio.com",
  projectId: "website-11b5c",
  storageBucket: "website-11b5c.firebasestorage.app",
  messagingSenderId: "821866548441",
  appId: "1:821866548441:web:00a08e534699a6f97902c8"
});

// Create a free reCAPTCHA v3 site key for firecatcher404.github.io, paste it
// below, deploy, verify requests, and only then enable App Check enforcement in
// the Firebase console. The app remains usable while this is blank.
export const appCheckConfig = Object.freeze({
  siteKey: ""
});
