import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js';
import { getDatabase, ref, onValue, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC4HaUzTDQsz1AKUCsv1ieY5G9WrCyTHrw',
  authDomain: 'website-11b5c.firebaseapp.com',
  databaseURL: 'https://website-11b5c-default-rtdb.firebaseio.com',
  projectId: 'website-11b5c',
  storageBucket: 'website-11b5c.firebasestorage.app',
  messagingSenderId: '821866548441',
  appId: '1:821866548441:web:00a08e534699a6f97902c8'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const THEME_KEY = 'blog_theme';
const root = document.documentElement;
const postsEl = document.getElementById('posts');
const emptyStateEl = document.getElementById('emptyState');
const postCountEl = document.getElementById('postCount');
const postingStatusEl = document.getElementById('postingStatus');
const themeLabel = document.getElementById('themeLabel');

function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
}

function initThemeToggle() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = saved || (prefersDark ? 'dark' : 'light');
  setTheme(current);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
}

function safeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function formatDate(value) {
  if (!value) return 'Undated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function renderPosts(posts) {
  postsEl.innerHTML = '';
  postCountEl.textContent = `${posts.length} post${posts.length === 1 ? '' : 's'}`;

  if (posts.length === 0) {
    emptyStateEl.classList.remove('hidden');
    return;
  }

  emptyStateEl.classList.add('hidden');
  const template = document.getElementById('postTemplate');

  posts.forEach((post) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.post-card');
    const legacyMeta = fragment.querySelector('.meta');
    const metaDate = fragment.querySelector('.meta-date');
    const metaAuthor = fragment.querySelector('.meta-author');
    const title = fragment.querySelector('.title');
    const excerpt = fragment.querySelector('.excerpt');
    const content = fragment.querySelector('.content');
    const readMore = fragment.querySelector('.read-more');

    const author = safeText(post.author || 'Anonymous');
    const postTitle = safeText(post.title || 'Untitled');
    const body = String(post.body || '').trim();
    const short = safeText(post.excerpt || body.slice(0, 180) || 'No content provided.');

    const publishedText = formatDate(post.publishedAt || post.createdAt);

    if (legacyMeta) legacyMeta.textContent = `${publishedText} • ${author}`;
    if (metaDate) metaDate.textContent = publishedText;
    if (metaAuthor) metaAuthor.textContent = author;
    if (title) title.textContent = postTitle;
    if (excerpt) excerpt.textContent = short;
    if (content) content.textContent = body;

    if (readMore && content) {
      readMore.addEventListener('click', () => {
        content.classList.toggle('hidden');
        readMore.textContent = content.classList.contains('hidden') ? 'Read post' : 'Hide';
      });
    }

    if (card) card.dataset.id = post.id;
    postsEl.appendChild(fragment);
  });
}

function connectPosts() {
  const postsRef = query(ref(db, 'posts'), orderByChild('published'), equalTo(true));

  onValue(
    postsRef,
    (snapshot) => {
      const value = snapshot.val() || {};
      const posts = Object.entries(value)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => {
          const aTime = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
      renderPosts(posts);
    },
    (error) => {
      console.error(error);
      postingStatusEl.innerHTML = '<h2>Publishing</h2><p>Could not load posts. Confirm Firebase rules allow read access to <code>/posts</code>.</p>';
      postCountEl.textContent = 'Load error';
    }
  );
}

function markSecurePostingStatus() {
  postingStatusEl.innerHTML = `
    <h2>Publishing</h2>
    <p>Posting from this public site is intentionally blocked. Use Firebase Console or a private admin tool tied to service-account credentials.</p>
  `;
}

initThemeToggle();
markSecurePostingStatus();
connectPosts();
