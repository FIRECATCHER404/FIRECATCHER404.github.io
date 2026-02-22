import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js';
import { getDatabase, ref, set, onValue, query, orderByChild, equalTo, push } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js';

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
const auth = getAuth(app);

const THEME_KEY = 'blog_theme';
const POST_ID_PARAM = 'postId';
const VISITOR_KEY = 'blog_visitor_id';
const COMMENT_NAME_KEY = 'blog_comment_name';
const IMAGE_TOKEN_RE = /\$\{image:([^}]+)\}/gi;

const root = document.documentElement;
const postsEl = document.getElementById('posts');
const emptyStateEl = document.getElementById('emptyState');
const postCountEl = document.getElementById('postCount');
const postingStatusEl = document.getElementById('postingStatus');
const themeLabel = document.getElementById('themeLabel');

const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const searchStatus = document.getElementById('searchStatus');

const authForm = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSignUp = document.getElementById('authSignUp');
const authSignOut = document.getElementById('authSignOut');
const authStatus = document.getElementById('authStatus');
const authStateText = document.getElementById('authStateText');

let allPosts = [];
let singlePostMode = false;
let currentUser = null;

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

  if (/^https?:\/\//i.test(name)) {
    return { primary: name, fallback: null };
  }

  const cleaned = name.replace(/^\/+/, '');
  if (cleaned.includes('..')) return null;

  if (/^(images|assets)\//i.test(cleaned)) {
    return { primary: cleaned, fallback: null };
  }

  return { primary: cleaned, fallback: `images/${cleaned}` };
}

function renderBodyContent(value = '') {
  let out = '';
  let lastIndex = 0;
  let match = IMAGE_TOKEN_RE.exec(value);

  while (match) {
    out += linkifyText(value.slice(lastIndex, match.index));

    const source = resolveImageSource(match[1]);
    if (source) {
      const safePrimary = escapeHtml(source.primary);
      const safeFallback = source.fallback ? escapeHtml(source.fallback) : '';
      const safeAlt = escapeHtml(match[1]);
      const fallbackAttr = source.fallback
        ? ` onerror="if(!this.dataset.fbk){this.dataset.fbk=1;this.src='${safeFallback}';}"`
        : '';
      out += `<figure class="post-image-wrap"><img class="post-image" src="${safePrimary}" alt="${safeAlt}" loading="lazy" decoding="async"${fallbackAttr}></figure>`;
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

function formatCommentDate(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function getPostIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
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

function getCommentDisplayName() {
  const fromProfile = currentUser?.displayName ? safeText(currentUser.displayName) : '';
  if (fromProfile) return fromProfile;
  const fromLocal = safeText(localStorage.getItem(COMMENT_NAME_KEY) || '');
  return fromLocal || 'Reader';
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

function getComments(post) {
  if (!post || !post.comments || typeof post.comments !== 'object') return [];
  return Object.entries(post.comments)
    .map(([id, data]) => ({ id, ...data }))
    .filter((item) => typeof item.text === 'string' && item.text.trim())
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

function normalizeSearch(value = '') {
  return String(value).toLowerCase().trim();
}

function filterPostsBySearch(posts, term) {
  if (!term) return posts;
  return posts.filter((post) => {
    const haystack = `${post.title || ''}\n${post.body || ''}`.toLowerCase();
    return haystack.includes(term);
  });
}

function createCommentItem(comment) {
  const card = document.createElement('article');
  card.className = 'comment-item';

  const meta = document.createElement('div');
  meta.className = 'comment-meta';

  const name = document.createElement('strong');
  name.textContent = safeText(comment.name || 'Reader');

  const time = document.createElement('span');
  time.textContent = formatCommentDate(comment.createdAt);

  const text = document.createElement('p');
  text.className = 'comment-text-view';
  text.textContent = String(comment.text || '').trim();

  meta.appendChild(name);
  meta.appendChild(time);
  card.appendChild(meta);
  card.appendChild(text);
  return card;
}

function bindCommentForm(form, postId) {
  const nameInput = form.querySelector('.comment-name');
  const textInput = form.querySelector('.comment-text');
  const statusEl = form.querySelector('.comment-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!nameInput || !textInput || !statusEl || !submitBtn) return;

  nameInput.value = getCommentDisplayName();

  if (!currentUser) {
    textInput.disabled = true;
    submitBtn.disabled = true;
    statusEl.textContent = 'Sign in above to post a comment.';
  } else {
    textInput.disabled = false;
    submitBtn.disabled = false;
    statusEl.textContent = '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentUser) {
      statusEl.textContent = 'Sign in above to post a comment.';
      return;
    }

    const name = safeText(nameInput.value);
    const text = String(textInput.value || '').trim();

    if (!name || name.length < 2 || name.length > 32) {
      statusEl.textContent = 'Name must be 2-32 characters.';
      return;
    }

    if (!text || text.length < 2 || text.length > 1000) {
      statusEl.textContent = 'Comment must be 2-1000 characters.';
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = 'Posting...';

    try {
      const commentRef = push(ref(db, `posts/${postId}/comments`));
      await set(commentRef, {
        uid: currentUser.uid,
        name,
        text,
        createdAt: Date.now()
      });
      localStorage.setItem(COMMENT_NAME_KEY, name);
      textInput.value = '';
      statusEl.textContent = 'Posted.';
    } catch (error) {
      console.error(error);
      statusEl.textContent = 'Failed to post comment.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function renderPosts(posts, options = {}) {
  const { isFiltered = false, emptyMessage = 'No posts yet.' } = options;

  postsEl.innerHTML = '';
  postCountEl.textContent = `${posts.length} post${posts.length === 1 ? '' : 's'}`;

  if (posts.length === 0) {
    emptyStateEl.textContent = emptyMessage;
    emptyStateEl.classList.remove('hidden');
    if (isFiltered) addFilteredBackButton();
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

    const commentEmpty = fragment.querySelector('.comment-empty');
    const commentList = fragment.querySelector('.comment-list');
    const commentForm = fragment.querySelector('.comment-form');

    const author = safeText(post.author || 'Anonymous');
    const postTitle = safeText(post.title || 'Untitled');
    const body = String(post.body || '').trim();

    if (metaDate) metaDate.textContent = formatDate(post.publishedAt || post.createdAt);
    if (metaAuthor) metaAuthor.textContent = author;
    if (title) title.textContent = postTitle;
    if (content) content.innerHTML = renderBodyContent(body);
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

    if (commentList && commentEmpty) {
      const comments = getComments(post);
      if (comments.length === 0) {
        commentEmpty.classList.remove('hidden');
      } else {
        commentEmpty.classList.add('hidden');
        comments.forEach((comment) => {
          commentList.appendChild(createCommentItem(comment));
        });
      }
    }

    if (commentForm) {
      bindCommentForm(commentForm, post.id);
    }

    if (card) card.dataset.id = post.id;
    postsEl.appendChild(fragment);
  });

  if (isFiltered) addFilteredBackButton();
}

function applySearchAndRender() {
  const term = normalizeSearch(searchInput?.value || '');
  const matches = filterPostsBySearch(allPosts, term);

  if (searchStatus) {
    if (term) {
      searchStatus.classList.remove('hidden');
      searchStatus.textContent = `Showing ${matches.length} of ${allPosts.length} for "${term}".`;
    } else {
      searchStatus.classList.add('hidden');
      searchStatus.textContent = '';
    }
  }

  const emptyMessage = term
    ? 'No posts matched your search.'
    : (singlePostMode ? 'Post not found or not published.' : 'No posts yet.');

  renderPosts(matches, { isFiltered: singlePostMode, emptyMessage });
}

function initSearch() {
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    applySearchAndRender();
  });

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      applySearchAndRender();
      searchInput.focus();
    });
  }
}

function setAuthStatus(message = '') {
  if (authStatus) authStatus.textContent = message;
}

function updateAuthUi() {
  const signedIn = !!currentUser;

  if (authStateText) {
    authStateText.textContent = signedIn
      ? `Signed in as ${safeText(currentUser.displayName || currentUser.email || 'user')}`
      : 'Sign in to comment.';
  }

  if (authSignOut) authSignOut.classList.toggle('hidden', !signedIn);

  if (authUsername) authUsername.disabled = signedIn;
  if (authEmail) authEmail.disabled = signedIn;
  if (authPassword) authPassword.disabled = signedIn;
  if (authSignUp) authSignUp.disabled = signedIn;

  if (authForm) {
    const submitButton = authForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = signedIn;
  }
}

async function handleSignIn(event) {
  event.preventDefault();
  const email = safeText(authEmail?.value || '');
  const password = String(authPassword?.value || '');

  if (!email || !password) {
    setAuthStatus('Email and password are required.');
    return;
  }

  setAuthStatus('Signing in...');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setAuthStatus('Signed in.');
  } catch (error) {
    console.error(error);
    setAuthStatus('Sign in failed. Check email/password.');
  }
}

async function handleSignUp() {
  const username = safeText(authUsername?.value || '');
  const email = safeText(authEmail?.value || '');
  const password = String(authPassword?.value || '');

  if (!username || username.length < 2 || username.length > 32) {
    setAuthStatus('Username must be 2-32 characters.');
    return;
  }

  if (!email || password.length < 8) {
    setAuthStatus('Email and password (min 8 chars) are required.');
    return;
  }

  setAuthStatus('Creating account...');

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: username });
    setAuthStatus('Account created and signed in.');
  } catch (error) {
    console.error(error);
    setAuthStatus('Sign up failed.');
  }
}

function initAuth() {
  if (authForm) {
    authForm.addEventListener('submit', handleSignIn);
  }

  if (authSignUp) {
    authSignUp.addEventListener('click', handleSignUp);
  }

  if (authSignOut) {
    authSignOut.addEventListener('click', async () => {
      setAuthStatus('Signing out...');
      try {
        await signOut(auth);
        setAuthStatus('Signed out.');
      } catch (error) {
        console.error(error);
        setAuthStatus('Sign out failed.');
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthUi();
    applySearchAndRender();
  });
}

function connectPosts() {
  const postId = getPostIdFromUrl();

  if (postId) {
    singlePostMode = true;
    const singlePostRef = ref(db, `posts/${postId}`);
    onValue(
      singlePostRef,
      (snapshot) => {
        const post = snapshot.val();
        if (!isPublishedPost(post)) {
          allPosts = [];
        } else {
          allPosts = [{ id: postId, ...post }];
        }
        applySearchAndRender();
      },
      (error) => {
        console.error(error);
        postCountEl.textContent = 'Load error';
      }
    );
    return;
  }

  singlePostMode = false;
  const postsRef = query(ref(db, 'posts'), orderByChild('published'), equalTo(true));

  onValue(
    postsRef,
    (snapshot) => {
      const value = snapshot.val() || {};
      allPosts = Object.entries(value)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => {
          const aTime = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
      applySearchAndRender();
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
    <p>Post creation from this public site is blocked. Use private admin scripts with service-account credentials. Comments require Firebase Auth accounts.</p>
  `;
}

initThemeToggle();
initSearch();
initAuth();
markSecurePostingStatus();
connectPosts();
