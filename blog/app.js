import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js';
import { getDatabase, ref, set, onValue, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js';

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
const POST_ID_PARAM = 'postId';
const VISITOR_KEY = 'blog_visitor_id';

const root = document.documentElement;
const postsEl = document.getElementById('posts');
const emptyStateEl = document.getElementById('emptyState');
const postCountEl = document.getElementById('postCount');
const postingStatusEl = document.getElementById('postingStatus');
const themeLabel = document.getElementById('themeLabel');

function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkifyText(value = '') {
  const escaped = escapeHtml(value);
  const urlPattern = /(https?:\/\/[^\s<]+)/g;

  return escaped.replace(urlPattern, (url) => {
    const cleanUrl = url.replace(/[),.;!?]+$/g, '');
    const trailing = url.slice(cleanUrl.length);
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trailing}`;
  });
}

function resolveImageSource(rawName = '') {
  const name = String(rawName).trim();
  if (!name) return null;

  if (/^https?:\/\//i.test(name)) return name;

  const cleaned = name.replace(/^\/+/, '');
  if (cleaned.includes('..')) return null;

  if (/^(images|assets)\//i.test(cleaned)) return cleaned;

  return `images/${cleaned}`;
}

function renderBodyContent(value = '') {
  let out = '';
  let lastIndex = 0;
  let match = IMAGE_TOKEN_RE.exec(value);

  while (match) {
    out += linkifyText(value.slice(lastIndex, match.index));

    const source = resolveImageSource(match[1]);
    if (source) {
      const safeSrc = escapeHtml(source);
      const safeAlt = escapeHtml(match[1]);
      out += `<figure class="post-image-wrap"><img class="post-image" src="${safeSrc}" alt="${safeAlt}" loading="lazy" decoding="async"></figure>`;
    } else {
      out += escapeHtml(match[0]);
    }

    lastIndex = match.index + match[0].length;
    match = IMAGE_TOKEN_RE.exec(value);
  }

  out += linkifyText(value.slice(lastIndex));
  IMAGE_TOKEN_RE.lastIndex = 0;
  return out;
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

function getPostIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  // Keep backwards compatibility for old links (?blogId=...)
  return (params.get(POST_ID_PARAM) || params.get('blogId') || '').trim();
}

function getVisitorId() {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;

  const generated = (window.crypto && typeof window.crypto.randomUUID === 'function')
    ? window.crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(VISITOR_KEY, generated);
  return generated;
}

function isPublishedPost(post) {
  return !!post && post.published === true;
}

function getLikeCount(post) {
  if (!post || !post.likesBy || typeof post.likesBy !== 'object') return 0;
  return Object.keys(post.likesBy).length;
}

function hasLiked(post, visitorId) {
  return !!(post && post.likesBy && post.likesBy[visitorId]);
}

function likeLabel(count) {
  return `${count} like${count === 1 ? '' : 's'}`;
}

function addFilteredBackButton() {
  const wrap = document.createElement('div');
  wrap.className = 'filtered-nav';

  const btn = document.createElement('button');
  btn.className = 'post-link-btn';
  btn.type = 'button';
  btn.textContent = 'Back to posts';
  btn.addEventListener('click', () => {
    window.location.href = `${window.location.origin}/blog/`;
  });

  wrap.appendChild(btn);
  postsEl.appendChild(wrap);
}

function renderPosts(posts, isFiltered = false) {
  postsEl.innerHTML = '';
  postCountEl.textContent = isFiltered ? `${posts.length} post` : `${posts.length} post${posts.length === 1 ? '' : 's'}`;

  if (posts.length === 0) {
    emptyStateEl.textContent = isFiltered ? 'Post not found or not published.' : 'No posts yet.';
    emptyStateEl.classList.remove('hidden');
    return;
  }

  emptyStateEl.classList.add('hidden');
  const template = document.getElementById('postTemplate');
  const visitorId = getVisitorId();

  posts.forEach((post) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.post-card');
    const metaDate = fragment.querySelector('.meta-date');
    const metaAuthor = fragment.querySelector('.meta-author');
    const title = fragment.querySelector('.title');
    const content = fragment.querySelector('.content');
    const likeBtn = fragment.querySelector('.like-btn');
    const likeBtnLabel = fragment.querySelector('.like-btn span');
    const likeCount = fragment.querySelector('.like-count');
    const postIdText = fragment.querySelector('.post-id');

    const author = safeText(post.author || 'Anonymous');
    const postTitle = safeText(post.title || 'Untitled');
    const body = String(post.body || '').trim();

    if (metaDate) metaDate.textContent = formatDate(post.publishedAt || post.createdAt);
    if (metaAuthor) metaAuthor.textContent = author;
    if (title) title.textContent = postTitle;
    if (content) content.innerHTML = linkifyText(body);
    if (postIdText) postIdText.textContent = `Post ID: ${post.id}`;

    const count = getLikeCount(post);
    const liked = hasLiked(post, visitorId);

    if (likeCount) likeCount.textContent = likeLabel(count);
    if (likeBtn && likeBtnLabel) {
      likeBtnLabel.textContent = liked ? 'Liked' : 'Like';
      likeBtn.disabled = liked;
      if (liked) likeBtn.classList.add('liked');

      likeBtn.addEventListener('click', async () => {
        likeBtn.disabled = true;
        try {
          await set(ref(db, `posts/${post.id}/likesBy/${visitorId}`), true);
          likeBtn.classList.add('liked');
          likeBtnLabel.textContent = 'Liked';
        } catch (error) {
          console.error(error);
          likeBtn.disabled = false;
          if (likeCount) likeCount.textContent = 'Like failed';
        }
      });
    }

    if (card) card.dataset.id = post.id;
    postsEl.appendChild(fragment);
  });

  if (isFiltered) addFilteredBackButton();
}

function connectPosts() {
  const postId = getPostIdFromUrl();

  if (postId) {
    const singlePostRef = ref(db, `posts/${postId}`);
    onValue(
      singlePostRef,
      (snapshot) => {
        const post = snapshot.val();
        if (!isPublishedPost(post)) {
          renderPosts([], true);
          return;
        }
        renderPosts([{ id: postId, ...post }], true);
      },
      (error) => {
        console.error(error);
        postCountEl.textContent = 'Load error';
      }
    );
    return;
  }

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
      renderPosts(posts, false);
    },
    (error) => {
      console.error(error);
      if (postingStatusEl) {
        postingStatusEl.innerHTML = '<h2>Publishing</h2><p>Could not load posts. Confirm Firebase rules allow read access to <code>/posts</code>.</p>';
      }
      postCountEl.textContent = 'Load error';
    }
  );
}

function markSecurePostingStatus() {
  if (!postingStatusEl) return;
  postingStatusEl.innerHTML = `
    <h2>Publishing</h2>
    <p>Posting from this public site is intentionally blocked. Use Firebase Console or a private admin tool tied to service-account credentials.</p>
  `;
}

initThemeToggle();
markSecurePostingStatus();
connectPosts();





