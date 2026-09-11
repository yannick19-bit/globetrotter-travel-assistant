import { t, getLang, setLang } from './i18n.js';
import { api, ApiError, getApiBase, setApiBase, getToken, getUser, setSession, clearSession, isLoggedIn } from './api.js';

const app = document.getElementById('app');

const state = {
  cart: new Map(),          // destination_id -> destination object (building a new trip)
  destCache: new Map(),     // destination_id -> destination object (lookups for display)
  filters: { search: '', category: '', budget_level: '' },
  lastDestinations: [],
};

const CATEGORIES = ['beach', 'mountain', 'city', 'culture', 'adventure', 'relaxation'];
const BUDGETS = ['budget', 'moderate', 'luxury'];

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function codeFor(name) {
  return (name || '???').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || '???';
}

function destinationFolderFor(dest) {
  const text = `${dest.name || ''} ${dest.country || ''}`.toLowerCase();
  if (/bali/.test(text)) return 'bali';
  if (/bangkok/.test(text)) return 'bangkok';
  if (/costa rica|costa-rica/.test(text)) return 'costa rica';
  if (/kyoto/.test(text)) return 'kyoto';
  if (/machu picchu|machu-picchu|machu/.test(text)) return 'machu picchu';
  if (/maldives/.test(text)) return 'maldives';
  if (/marrakech/.test(text)) return 'marrakech';
  if (/paris/.test(text)) return 'paris';
  if (/santorini/.test(text)) return 'santorini';
  if (/swiss alps|swiss-alps|alps/.test(text)) return 'swiss alps';
  return null;
}

async function fetchFolderImages(folder) {
  if (!folder) return [];
  try {
    const resp = await fetch(`/api/images/${encodeURIComponent(folder)}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.images) ? data.images : [];
  } catch (e) {
    return [];
  }
}

function escapeHtmlUrl(path) {
  return path.replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function firstImageForDestination(dest) {
  const folder = destinationFolderFor(dest);
  if (!folder) return '';
  return `/images/${folder}/`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function navigate(hash) {
  if (location.hash === hash) { render(); } else { location.hash = hash; }
}

/* ---------------- Topbar ---------------- */
function renderTopbar() {
  const route = currentRoute();
  const loggedIn = isLoggedIn();
  return `
    <header class="topbar">
      <a href="#/" class="brand" data-action="nav" data-hash="#/">
        <span class="flap">${esc(t('brand_tag'))}</span> GlobeTrotter
      </a>
      <nav class="nav">
        <a href="#/" class="nav-link ${route.name === 'home' ? 'active' : ''}" data-action="nav" data-hash="#/">${esc(t('nav_home'))}</a>
        <a href="#/explore" class="nav-link ${route.name === 'explore' ? 'active' : ''}" data-action="nav" data-hash="#/explore">${esc(t('nav_explore'))}</a>
        ${loggedIn ? `<a href="#/trips" class="nav-link ${route.name === 'trips' || route.name === 'trip-detail' ? 'active' : ''}" data-action="nav" data-hash="#/trips">${esc(t('nav_trips'))}</a>` : ''}
      </nav>
      <div class="top-actions">
        <div class="lang-toggle" role="group" aria-label="Language">
          <button data-action="lang" data-lang="en" class="${getLang() === 'en' ? 'active' : ''}">EN</button>
          <button data-action="lang" data-lang="fr" class="${getLang() === 'fr' ? 'active' : ''}">FR</button>
        </div>
        <button class="icon-btn" data-action="open-settings" aria-label="${esc(t('settings_title'))}" title="${esc(t('settings_title'))}">⚙</button>
        ${loggedIn
          ? `<button class="btn btn-ghost btn-sm" data-action="logout">${esc(t('nav_logout'))}</button>`
          : `<button class="btn btn-ghost btn-sm" data-action="nav" data-hash="#/login">${esc(t('nav_login'))}</button>
             <button class="btn btn-primary btn-sm" data-action="nav" data-hash="#/register">${esc(t('nav_register'))}</button>`
        }
      </div>
    </header>
  `;
}

/* ---------------- Home page ---------------- */
const HOME_GALLERY = [
  { url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80&auto=format&fit=crop', captionKey: 'home_gallery_1_caption' },
  { url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80&auto=format&fit=crop', captionKey: 'home_gallery_2_caption' },
  { url: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=800&q=80&auto=format&fit=crop', captionKey: 'home_gallery_3_caption' },
  { url: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80&auto=format&fit=crop', captionKey: 'home_gallery_4_caption' },
];

// ---------------------------------------------------------------------
// CONFIG VIDÉO — modifie ce tableau pour utiliser tes propres vidéos.
//
// Deux types possibles pour chaque entrée :
//
// 1) type: 'youtube'  -> vidéo hébergée sur YouTube (rien à installer)
//    id: l'identifiant de la vidéo, trouvable dans l'URL YouTube.
//
// 2) type: 'local'    -> ton propre fichier vidéo (.mp4)
//    src: le chemin vers le fichier, placé dans frontend/public/video/
//
// caption : texte affiché à côté de la vidéo, décrivant le lieu.
//           Renseigne { fr: '...', en: '...' } pour chaque vidéo.
//
// vertical : mets `true` si la vidéo est filmée en format portrait
//            (cas de la plupart des vidéos TikTok/Instagram Reels).
// ---------------------------------------------------------------------
const HOME_VIDEOS = [
  { type: 'local', src: '/video/video-1.mp4', vertical: true, caption: { fr: 'Kyoto, Japon', en: 'Kyoto, Japan' } },
  { type: 'local', src: '/video/video-2.mp4', vertical: true, caption: { fr: 'Paris, France', en: 'Paris, France' } },
  { type: 'local', src: '/video/video-3.mp4', vertical: true, caption: { fr: 'Grèce', en: 'Greece' } },
  { type: 'local', src: '/video/video-4.mp4', vertical: true, caption: { fr: 'Maldives', en: 'Maldives' } },
  { type: 'local', src: '/video/video-5.mp4', vertical: true, caption: { fr: 'Pérou', en: 'Peru' } },
];

function renderHomeVideo(video) {
  const caption = video.caption ? (video.caption[getLang()] || video.caption.en || '') : '';
  const shapeClass = video.vertical ? 'home-video-media-portrait' : 'home-video-media-landscape';

  const mediaHtml = video.type === 'local'
    ? `
      <video controls preload="auto" ${video.poster ? `poster="${esc(video.poster)}"` : ''}>
        <source src="${esc(video.src)}" type="video/mp4" />
      </video>
    `
    : `
      <iframe
        src="https://www.youtube.com/embed/${esc(video.id)}"
        title="Travel inspiration"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
      ></iframe>
    `;

  return `
    <article class="home-video-card">
      <div class="home-video-media ${shapeClass}">${mediaHtml}</div>
      ${caption ? `<p class="home-video-caption">${esc(caption)}</p>` : ''}
    </article>
  `;
}

const HOME_HIGHLIGHTS = [
  { category: 'beach', icon: '🏖️' },
  { category: 'mountain', icon: '⛰️' },
  { category: 'city', icon: '🏙️' },
  { category: 'culture', icon: '🏛️' },
];

function renderHome() {
  const loggedIn = isLoggedIn();
  app.innerHTML = layout(`
    <section class="home-hero">
      <div class="board-eyebrow">${esc(t('home_eyebrow'))}</div>
      <h1 class="home-title">${esc(t('home_welcome_title'))}</h1>
      <p class="home-sub">${esc(t('home_welcome_sub'))}</p>
      <div class="home-cta-row">
        <button class="btn btn-primary" data-action="nav" data-hash="#/explore">${esc(t('home_cta_explore'))}</button>
        ${loggedIn ? `<button class="btn btn-secondary" data-action="nav" data-hash="#/trips">${esc(t('home_cta_trips'))}</button>` : ''}
      </div>
    </section>

    <section class="home-section">
      <div class="board-eyebrow">${esc(t('home_gallery_eyebrow'))}</div>
      <h2 class="home-section-title">${esc(t('home_gallery_title'))}</h2>
      <div class="home-gallery">
        ${HOME_GALLERY.map(g => `
          <figure class="home-gallery-item">
            <img src="${g.url}" alt="${esc(t(g.captionKey))}" loading="lazy" />
            <figcaption>${esc(t(g.captionKey))}</figcaption>
          </figure>
        `).join('')}
      </div>
    </section>

    <section class="home-section">
      <div class="board-eyebrow">${esc(t('home_video_eyebrow'))}</div>
      <h2 class="home-section-title">${esc(t('home_video_title'))}</h2>
      <p class="home-section-sub">${esc(t('home_video_sub'))}</p>
      <div class="home-video-grid">
        ${HOME_VIDEOS.map(renderHomeVideo).join('')}
      </div>
    </section>

    <section class="home-section">
      <h2 class="home-section-title">${esc(t('home_highlights_title'))}</h2>
      <div class="home-highlights">
        ${HOME_HIGHLIGHTS.map(h => `
          <button class="home-highlight-card" data-action="explore-category" data-category="${h.category}">
            <span class="home-highlight-icon">${h.icon}</span>
            <span class="home-highlight-label">${esc(t('cat_' + h.category))}</span>
            <span class="home-highlight-desc">${esc(t('home_highlight_' + h.category + '_desc'))}</span>
          </button>
        `).join('')}
      </div>
    </section>
  `);

  bindGlobalHandlers();
}

/* ---------------- Explore page ---------------- */
async function renderExplore() {
  app.innerHTML = layout(`
    <section class="board-hero">
      <div class="board-eyebrow">${esc(t('hero_eyebrow'))}</div>
      <h1 class="board-title">${esc(t('hero_title'))}</h1>
      <p class="board-sub">${esc(t('hero_sub'))}</p>
    </section>

    <div class="filter-bar">
      <input type="text" class="search-input" id="search-input" placeholder="${esc(t('search_placeholder'))}" value="${esc(state.filters.search)}" />
    </div>
    <div class="filter-bar" id="chip-bar">
      ${chip('category', '', t('filter_all'))}
      ${CATEGORIES.map(c => chip('category', c, t('cat_' + c))).join('')}
    </div>
    <div class="filter-bar" id="chip-bar-2">
      ${chip('budget_level', '', t('filter_all'))}
      ${BUDGETS.map(b => chip('budget_level', b, t('budget_' + b))).join('')}
    </div>

    <div id="dest-results"><div class="empty-state"><span class="spinner"></span></div></div>
  `);

  bindGlobalHandlers();

  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadDestinations, 350);
  });

  await loadDestinations();
  renderCartBar();
}

function chip(field, value, label) {
  const active = state.filters[field] === value;
  return `<button class="chip ${active ? 'active' : ''}" data-action="filter" data-field="${field}" data-value="${esc(value)}">${esc(label)}</button>`;
}

async function loadDestinations() {
  const results = document.getElementById('dest-results');
  if (!results) return;
  results.innerHTML = `<div class="empty-state"><span class="spinner"></span></div>`;
  try {
    const data = await api.searchDestinations(state.filters);
    state.lastDestinations = data.destinations;
    const destinations = data.destinations || [];

    for (const d of destinations) {
      state.destCache.set(d.id, d);
      const folder = destinationFolderFor(d);
      if (!folder) continue;
      const images = await fetchFolderImages(folder);
      d.cardImage = images.length ? `/images/${encodeURIComponent(folder)}/${encodeURIComponent(images[0])}` : '';
    }

    if (destinations.length === 0) {
      results.innerHTML = `<div class="empty-state"><h3>${esc(t('no_destinations'))}</h3><p>${esc(t('no_destinations_hint'))}</p></div>`;
      return;
    }
    results.innerHTML = `<div class="dest-grid">${destinations.map(destCard).join('')}</div>`;
  } catch (e) {
    results.innerHTML = `<div class="alert alert-error">${esc(errorMessage(e))}</div>`;
  }
}

function destCard(d) {
  const inCart = state.cart.has(d.id);
  const folder = destinationFolderFor(d);
  const imageUrl = d.cardImage || '';
  const style = imageUrl
    ? `background-image: linear-gradient(180deg, rgba(11, 14, 23, 0.46), rgba(11, 14, 23, 0.74)), url('${imageUrl}'); background-size: cover; background-position: center; min-height: 330px;`
    : '';

  return `
    <article class="dest-card" style="${style}">
      <button class="dest-card-top dest-card-top-link" data-action="nav" data-hash="#/destinations/${d.id}">
        <div>
          <p class="dest-name">${esc(d.name)}</p>
          <p class="dest-country">${esc(d.country)}</p>
        </div>
        <span class="dest-code">${codeFor(d.name)}</span>
      </button>
      <p class="dest-desc">${esc(d.description || '')}</p>
      <div class="dest-meta">
        <span class="tag">${esc(t('cat_' + d.category))}</span>
        <span class="tag budget-${esc(d.budget_level)}">${esc(t('budget_' + d.budget_level))}</span>
        <span class="tag">${esc(t('popularity'))} ${esc(d.popularity_score)}</span>
      </div>
      <div class="dest-actions">
        <button class="btn btn-secondary btn-block btn-sm" data-action="nav" data-hash="#/destinations/${d.id}">${esc(t('view_details'))}</button>
        <button class="btn ${inCart ? 'btn-secondary' : 'btn-primary'} btn-block btn-sm" data-action="toggle-cart" data-id="${d.id}">
          ${inCart ? '✓ ' + esc(t('added')) : esc(t('add_to_trip'))}
        </button>
      </div>
    </article>
  `;
}

/* ---------------- Destination detail (galleries by zone) ---------------- */
const MEDIA_CATEGORIES = ['landscape', 'hotel', 'culture'];
let currentDestDetailId = null;

async function renderDestinationDetail(id) {
  currentDestDetailId = id;
  if (!state.destDetailTab) state.destDetailTab = 'landscape';

  app.innerHTML = layout(`<div class="empty-state"><span class="spinner"></span></div>`);
  bindGlobalHandlers();

  try {
    const dest = await api.getDestination(id);
    state.destCache.set(dest.id, dest);
    paintDestinationDetail(dest.id);
  } catch (e) {
    app.innerHTML = layout(`
      <button class="btn btn-ghost btn-sm" style="margin-bottom:18px" data-action="nav" data-hash="#/explore">${esc(t('dest_back_to_explore'))}</button>
      <div class="alert alert-error">${e instanceof ApiError && e.status === 404 ? esc(t('dest_not_found')) : esc(errorMessage(e))}</div>
    `);
    bindGlobalHandlers();
  }
}

async function paintDestinationDetail(id) {
  const dest = state.destCache.get(Number(id));
  if (!dest) return;

  const activeTab = state.destDetailTab || 'landscape';
  const media = dest.media || { landscape: [], hotel: [], culture: [] };
  const activeItems = media[activeTab] || [];
  const canAdmin = isLoggedIn() && getUser() && getUser().is_admin;
  const folder = destinationFolderFor(dest);
  const folderImages = folder ? await fetchFolderImages(folder) : [];
  const staticGalleryHtml = folderImages.length > 0
    ? renderStaticFolderCarousel(folder, folderImages, dest.name)
    : '';

  app.innerHTML = layout(`
    <button class="btn btn-ghost btn-sm" style="margin-bottom:18px" data-action="nav" data-hash="#/explore">${esc(t('dest_back_to_explore'))}</button>

    <section class="board-hero">
      <div class="board-eyebrow">${esc(dest.country)} · ${esc(t('cat_' + dest.category))}</div>
      <h1 class="board-title" style="font-size:clamp(28px,5vw,48px)">${esc(dest.name)}</h1>
      <p class="board-sub">${esc(dest.description || '')}</p>
    </section>

    <div class="dest-detail-layout">
      <div class="dest-detail-main">
        <div class="tab-bar" role="tablist">
          ${MEDIA_CATEGORIES.map(cat => `
            <button class="tab-btn ${activeTab === cat ? 'active' : ''}" data-action="switch-dest-tab" data-category="${cat}" role="tab" aria-selected="${activeTab === cat}">
              ${esc(t('dest_tab_' + cat))} <span class="tab-count">${(media[cat] || []).length}</span>
            </button>
          `).join('')}
        </div>

        <div id="dest-gallery">
          ${staticGalleryHtml || (activeItems.length === 0
            ? `<div class="empty-state"><p>${esc(t('dest_gallery_empty'))}</p></div>`
            : `<div class="home-gallery">
                ${activeItems.map(m => `
                  <figure class="home-gallery-item dest-gallery-item">
                    <img src="${esc(getApiBase() + m.url)}" alt="${esc(m.caption || dest.name)}" loading="lazy" />
                    ${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}
                    ${canAdmin ? `<button class="btn btn-danger btn-sm dest-media-delete" data-action="delete-media" data-media-id="${m.id}">${esc(t('dest_admin_delete'))}</button>` : ''}
                  </figure>
                `).join('')}
              </div>`)
          }
        </div>

        ${canAdmin ? `
          <div class="admin-upload-card">
            <h3>${esc(t('dest_admin_upload_title'))}</h3>
            <div id="dest-upload-error"></div>
            <form id="dest-upload-form">
              <div class="field">
                <label>${esc(t('dest_admin_upload_category'))}</label>
                <select name="category">
                  ${MEDIA_CATEGORIES.map(cat => `<option value="${cat}" ${cat === activeTab ? 'selected' : ''}>${esc(t('dest_tab_' + cat))}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label>${esc(t('dest_admin_upload_caption'))}</label>
                <input type="text" name="caption" placeholder="${esc(t('dest_admin_upload_caption_placeholder'))}" />
              </div>
              <div class="field">
                <label>${esc(t('dest_admin_upload_file'))}</label>
                <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
              </div>
              <button type="submit" class="btn btn-primary btn-block">${esc(t('dest_admin_upload_submit'))}</button>
            </form>
          </div>
        ` : ''}
      </div>

      <aside class="dest-detail-side">
        <h3>${esc(t('dest_practical_info'))}</h3>
        <dl class="info-list">
          <dt>${esc(t('dest_country_label'))}</dt><dd>${esc(dest.country)}</dd>
          <dt>${esc(t('dest_category_label'))}</dt><dd>${esc(t('cat_' + dest.category))}</dd>
          <dt>${esc(t('dest_budget_label'))}</dt><dd>${esc(t('budget_' + dest.budget_level))}</dd>
          <dt>${esc(t('dest_popularity_label'))}</dt><dd>${esc(dest.popularity_score)}</dd>
        </dl>
        <button class="btn ${state.cart.has(dest.id) ? 'btn-secondary' : 'btn-primary'} btn-block" data-action="toggle-cart" data-id="${dest.id}">
          ${state.cart.has(dest.id) ? '✓ ' + esc(t('added')) : esc(t('add_to_trip'))}
        </button>
      </aside>
    </div>
  `);

  bindGlobalHandlers();

  if (folderImages.length > 0) {
    initDestinationCarousel();
  }

  const uploadForm = document.getElementById('dest-upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(uploadForm);
      const file = fd.get('file');
      const errBox = document.getElementById('dest-upload-error');
      const submitBtn = uploadForm.querySelector('button[type="submit"]');
      if (!file || file.size === 0) return;

      errBox.innerHTML = '';
      submitBtn.disabled = true;
      submitBtn.textContent = t('dest_admin_upload_uploading');
      try {
        await api.uploadDestinationMedia(dest.id, fd.get('category'), file, fd.get('caption'));
        const refreshed = await api.getDestination(dest.id);
        state.destCache.set(dest.id, refreshed);
        state.destDetailTab = fd.get('category');
        paintDestinationDetail(dest.id);
      } catch (err) {
        errBox.innerHTML = `<div class="alert alert-error">${esc(errorMessage(err))}</div>`;
        submitBtn.disabled = false;
        submitBtn.textContent = t('dest_admin_upload_submit');
      }
    });
  }
}


function renderStaticFolderCarousel(folder, images, destinationName) {
  if (!images || images.length === 0) return '';
  const safeFolder = encodeURIComponent(folder);
  const slides = images.map((name, idx) => `
    <figure class="dest-detail-slide ${idx === 0 ? 'active' : ''}" data-slide="${idx}">
      <img src="/images/${safeFolder}/${encodeURIComponent(name)}" alt="${esc(destinationName)}" loading="lazy" />
    </figure>
  `).join('');

  const dots = images.map((_, idx) => `<button class="dest-detail-dot ${idx === 0 ? 'active' : ''}" data-action="carousel-dot" data-index="${idx}"></button>`).join('');

  return `<section class="dest-detail-carousel" aria-label="${esc(destinationName)} gallery">
    <div class="dest-detail-carousel-frame">
      <div class="dest-detail-carousel-track">${slides}</div>
      <button class="dest-detail-arrow prev" data-action="carousel-prev" aria-label="Previous image">‹</button>
      <button class="dest-detail-arrow next" data-action="carousel-next" aria-label="Next image">›</button>
    </div>
    <div class="dest-detail-carousel-dots">${dots}</div>
  </section>`;
}

function initDestinationCarousel() {
  const carousel = document.querySelector('.dest-detail-carousel');
  if (!carousel) return;
  const track = carousel.querySelector('.dest-detail-carousel-track');
  const slides = Array.from(carousel.querySelectorAll('[data-slide]'));
  const dots = Array.from(carousel.querySelectorAll('[data-action="carousel-dot"]'));
  const nextBtn = carousel.querySelector('[data-action="carousel-next"]');
  const prevBtn = carousel.querySelector('[data-action="carousel-prev"]');
  let current = 0;
  let startX = 0;

  function showSlide(idx) {
    if (slides.length === 0) return;
    current = (idx + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  nextBtn?.addEventListener('click', () => showSlide(current + 1));
  prevBtn?.addEventListener('click', () => showSlide(current - 1));
  dots.forEach((dot) => dot.addEventListener('click', () => showSlide(Number(dot.dataset.index))));

  carousel.addEventListener('touchstart', (e) => { startX = e.changedTouches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) showSlide(current + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

function renderCartBar() {
  const existing = document.getElementById('trip-cart-bar');
  if (existing) existing.remove();
  if (state.cart.size === 0) return;
  const bar = document.createElement('div');
  bar.className = 'trip-cart';
  bar.id = 'trip-cart-bar';
  bar.innerHTML = `
    <div class="trip-cart-label"><strong>${state.cart.size}</strong> ${esc(t('cart_label'))}</div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-ghost btn-sm" data-action="clear-cart">${esc(t('cart_clear'))}</button>
      <button class="btn btn-primary btn-sm" data-action="open-new-trip">${esc(t('cart_build'))}</button>
    </div>
  `;
  document.querySelector('main').appendChild(bar);
}

/* ---------------- New itinerary modal ---------------- */
function openNewTripModal() {
  const stops = [...state.cart.values()];
  openModal(`
    <h2>${esc(t('new_trip_title'))}</h2>
    <form id="new-trip-form">
      <div class="field">
        <label>${esc(t('field_title'))}</label>
        <input type="text" name="title" placeholder="${esc(t('field_title_ph'))}" required />
      </div>
      <div style="display:flex; gap:12px;">
        <div class="field" style="flex:1">
          <label>${esc(t('field_start'))}</label>
          <input type="date" name="start_date" />
        </div>
        <div class="field" style="flex:1">
          <label>${esc(t('field_end'))}</label>
          <input type="date" name="end_date" />
        </div>
      </div>
      <div class="field">
        <label>${esc(t('field_stops'))} (${stops.length})</label>
        <div class="destination-picker">
          ${stops.length ? stops.map(s => `
            <div class="picker-row">
              <span>${esc(s.name)} — ${esc(s.country)}</span>
              <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-cart" data-id="${s.id}" data-refresh-modal="1">✕</button>
            </div>
          `).join('') : `<div class="picker-row">${esc(t('no_destinations'))}</div>`}
        </div>
      </div>
      <div id="new-trip-error"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">${esc(t('modal_cancel'))}</button>
        <button type="submit" class="btn btn-primary" ${stops.length === 0 ? 'disabled' : ''}>${esc(t('modal_create'))}</button>
      </div>
    </form>
  `);

  document.getElementById('new-trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = document.getElementById('new-trip-error');
    try {
      const res = await api.createItinerary({
        title: fd.get('title'),
        start_date: fd.get('start_date') || null,
        end_date: fd.get('end_date') || null,
        destination_ids: [...state.cart.keys()]
      });
      state.cart.clear();
      closeModal();
      navigate(`#/trips/${res.itinerary_id}`);
    } catch (err) {
      errBox.innerHTML = `<div class="alert alert-error">${esc(errorMessage(err))}</div>`;
    }
  });
}

/* ---------------- Trips list ---------------- */
async function renderTrips() {
  app.innerHTML = layout(`
    <section class="board-hero">
      <div class="board-eyebrow">${esc(t('nav_trips'))}</div>
      <h1 class="board-title">${esc(t('trips_title'))}</h1>
      <p class="board-sub">${esc(t('trips_sub'))}</p>
    </section>
    <div style="display:flex; justify-content:flex-end; margin-bottom:18px;">
      <button class="btn btn-primary" data-action="nav" data-hash="#/">${esc(t('trip_new_btn'))}</button>
    </div>
    <div id="trips-list"><div class="empty-state"><span class="spinner"></span></div></div>
  `);
  bindGlobalHandlers();

  const list = document.getElementById('trips-list');
  try {
    const data = await api.listItineraries();
    if (data.itineraries.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>${esc(t('no_trips'))}</h3>
          <p>${esc(t('no_trips_hint'))}</p>
          <button class="btn btn-primary" style="margin-top:14px" data-action="nav" data-hash="#/">${esc(t('no_trips_cta'))}</button>
        </div>`;
      bindGlobalHandlers();
      return;
    }
    list.innerHTML = data.itineraries.map(tripPass).join('');
  } catch (e) {
    list.innerHTML = `<div class="alert alert-error">${esc(errorMessage(e))}</div>`;
  }
}

function tripPass(itin) {
  return `
    <div class="pass">
      <div class="pass-main">
        <span class="pass-eyebrow">#${itin.id} · ${esc(itin.access_type || 'owner')}</span>
        <div class="pass-route">${esc(itin.title)}</div>
        <span class="pass-status status-${esc(itin.status)}">${esc(t('status_' + itin.status))}</span>
      </div>
      <div class="pass-perf"></div>
      <div class="pass-stub">
        <div class="pass-stub-item"><span>${esc(t('created'))}</span><strong>${formatDate(itin.created_at)}</strong></div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <button class="btn btn-secondary btn-sm btn-block" data-action="nav" data-hash="#/trips/${itin.id}">${esc(t('view'))}</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------------- Trip detail ---------------- */
async function renderTripDetail(id) {
  app.innerHTML = layout(`<div class="empty-state"><span class="spinner"></span></div>`);
  bindGlobalHandlers();
  try {
    const itin = await api.getItinerary(id);
    const names = itin.items.map(i => i.destination && i.destination.name).filter(Boolean);
    const routeLabel = names.length > 1
      ? names.join(' <span class="arrow">→</span> ')
      : (names[0] || itin.title);

    app.innerHTML = layout(`
      <button class="btn btn-ghost btn-sm" style="margin-bottom:18px" data-action="nav" data-hash="#/trips">← ${esc(t('trip_detail_back'))}</button>
      <section class="board-hero">
        <div class="board-eyebrow">${esc(t('trip_detail_route'))}</div>
        <h1 class="board-title" style="font-size:clamp(24px,4vw,40px)">${routeLabel}</h1>
        <p class="board-sub">${esc(itin.title)}</p>
        <div style="margin-top:14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <span class="pass-status status-${esc(itin.status)}">${esc(t('status_' + itin.status))}</span>
          <span style="color:var(--text-dim); font-size:13px;">${esc(t('created'))} ${formatDate(itin.created_at)}</span>
        </div>
      </section>

      <div style="display:flex; gap:10px; margin-bottom:22px; flex-wrap:wrap;">
        <button class="btn btn-secondary" data-action="open-edit-trip" data-id="${itin.id}">${esc(t('trip_detail_edit'))}</button>
        <button class="btn btn-secondary" data-action="open-share-trip" data-id="${itin.id}">${esc(t('trip_detail_share'))}</button>
        <button class="btn btn-danger" data-action="delete-trip" data-id="${itin.id}">${esc(t('delete'))}</button>
      </div>

      <h3 style="font-family:var(--font-display); text-transform:uppercase; font-size:20px; margin-bottom:0;">${esc(t('trip_detail_stops'))}</h3>
      <div class="stop-list">
        ${itin.items.length === 0
          ? `<p style="color:var(--text-dim)">${esc(t('trip_detail_no_stops'))}</p>`
          : itin.items.map((item, idx) => `
            <div class="stop">
              <div class="stop-index">${String(idx + 1).padStart(2, '0')}</div>
              <div class="stop-body">
                <h4>${item.destination ? esc(item.destination.name) : '—'}</h4>
                <p>${item.destination ? esc(item.destination.country) + ' · ' + esc(t('cat_' + item.destination.category)) : ''}</p>
              </div>
            </div>
          `).join('')
        }
      </div>
    `);
    bindGlobalHandlers();
    app.dataset.currentItinerary = JSON.stringify(itin);
  } catch (e) {
    app.innerHTML = layout(`<div class="alert alert-error">${esc(errorMessage(e))}</div>`);
    bindGlobalHandlers();
  }
}

function openEditTripModal(id) {
  const itin = JSON.parse(app.dataset.currentItinerary || '{}');
  openModal(`
    <h2>${esc(t('edit_title'))}</h2>
    <form id="edit-trip-form">
      <div class="field">
        <label>${esc(t('field_title'))}</label>
        <input type="text" name="title" value="${esc(itin.title || '')}" required />
      </div>
      <div style="display:flex; gap:12px;">
        <div class="field" style="flex:1">
          <label>${esc(t('field_start'))}</label>
          <input type="date" name="start_date" value="${itin.start_date ? itin.start_date.slice(0,10) : ''}" />
        </div>
        <div class="field" style="flex:1">
          <label>${esc(t('field_end'))}</label>
          <input type="date" name="end_date" value="${itin.end_date ? itin.end_date.slice(0,10) : ''}" />
        </div>
      </div>
      <div class="field">
        <label>${esc(t('field_status'))}</label>
        <select name="status">
          ${['draft','confirmed','completed','cancelled'].map(s => `<option value="${s}" ${itin.status === s ? 'selected' : ''}>${esc(t('status_' + s))}</option>`).join('')}
        </select>
      </div>
      <div id="edit-trip-error"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">${esc(t('modal_cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('save_changes'))}</button>
      </div>
    </form>
  `);

  document.getElementById('edit-trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.updateItinerary(id, {
        title: fd.get('title'),
        start_date: fd.get('start_date') || null,
        end_date: fd.get('end_date') || null,
        status: fd.get('status'),
      });
      closeModal();
      renderTripDetail(id);
    } catch (err) {
      document.getElementById('edit-trip-error').innerHTML = `<div class="alert alert-error">${esc(errorMessage(err))}</div>`;
    }
  });
}

function openShareTripModal(id) {
  openModal(`
    <h2>${esc(t('share_title'))}</h2>
    <p style="color:var(--text-dim); font-size:13px; margin-top:-8px;">${esc(t('share_hint'))}</p>
    <form id="share-trip-form">
      <div class="field">
        <label>${esc(t('field_user_id'))}</label>
        <input type="number" name="user_id" min="1" required />
      </div>
      <div class="field">
        <label>${esc(t('field_permission'))}</label>
        <select name="permission">
          <option value="view">${esc(t('perm_view'))}</option>
          <option value="edit">${esc(t('perm_edit'))}</option>
        </select>
      </div>
      <div id="share-trip-error"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">${esc(t('modal_cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('share_submit'))}</button>
      </div>
    </form>
  `);

  document.getElementById('share-trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.shareItinerary(id, fd.get('user_id'), fd.get('permission'));
      closeModal();
      toast(t('share_success'));
    } catch (err) {
      document.getElementById('share-trip-error').innerHTML = `<div class="alert alert-error">${esc(errorMessage(err))}</div>`;
    }
  });
}

async function deleteTrip(id) {
  if (!confirm(t('delete_confirm'))) return;
  try {
    await api.deleteItinerary(id);
    navigate('#/trips');
  } catch (e) {
    alert(errorMessage(e));
  }
}

/* ---------------- Auth pages ---------------- */
function renderLogin() {
  app.innerHTML = layout(`
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="board-eyebrow">${esc(t('auth_login_eyebrow'))}</div>
        <h1>${esc(t('auth_login_title'))}</h1>
        <div id="auth-error"></div>
        <form id="login-form">
          <div class="field">
            <label>${esc(t('field_email'))}</label>
            <input type="email" name="email" required autocomplete="username" />
          </div>
          <div class="field">
            <label>${esc(t('field_password'))}</label>
            <input type="password" name="password" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-block">${esc(t('login_submit'))}</button>
        </form>
        <div class="form-foot">${esc(t('login_switch'))} <a href="#/register" data-action="nav" data-hash="#/register">${esc(t('login_switch_link'))}</a></div>
      </div>
    </div>
  `);
  bindGlobalHandlers();

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = document.getElementById('auth-error');
    try {
      const res = await api.login(fd.get('email'), fd.get('password'));
      setSession(res.token, res.user);
      navigate('#/trips');
    } catch (err) {
      errBox.innerHTML = `<div class="alert alert-error">${esc(errorMessage(err))}</div>`;
    }
  });
}

function renderRegister() {
  app.innerHTML = layout(`
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="board-eyebrow">${esc(t('auth_register_eyebrow'))}</div>
        <h1>${esc(t('auth_register_title'))}</h1>
        <div id="auth-error"></div>
        <form id="register-form">
          <div class="field">
            <label>${esc(t('field_full_name'))}</label>
            <input type="text" name="full_name" required autocomplete="name" />
          </div>
          <div class="field">
            <label>${esc(t('field_email'))}</label>
            <input type="email" name="email" required autocomplete="username" />
          </div>
          <div class="field">
            <label>${esc(t('field_password'))}</label>
            <input type="password" name="password" required minlength="6" autocomplete="new-password" />
            <div style="font-size:12px; color:var(--text-faint); margin-top:4px;">${esc(t('field_password_hint'))}</div>
          </div>
          <button type="submit" class="btn btn-primary btn-block">${esc(t('register_submit'))}</button>
        </form>
        <div class="form-foot">${esc(t('register_switch'))} <a href="#/login" data-action="nav" data-hash="#/login">${esc(t('register_switch_link'))}</a></div>
      </div>
    </div>
  `);
  bindGlobalHandlers();

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = document.getElementById('auth-error');
    try {
      const res = await api.register(fd.get('full_name'), fd.get('email'), fd.get('password'));
      setSession(res.token, res.user);
      navigate('#/trips');
    } catch (err) {
      errBox.innerHTML = `<div class="alert alert-error">${esc(errorMessage(err))}</div>`;
    }
  });
}

/* ---------------- Settings modal ---------------- */
function openSettingsModal() {
  openModal(`
    <h2>${esc(t('settings_title'))}</h2>
    <div class="field">
      <label>${esc(t('settings_api_label'))}</label>
      <input type="text" id="api-base-input" value="${esc(getApiBase())}" />
      <div style="font-size:12px; color:var(--text-faint); margin-top:6px;">${esc(t('settings_api_hint'))}</div>
    </div>
    <div id="conn-status" style="font-size:13px; color:var(--text-dim); margin-bottom:6px;">
      <span class="spinner" style="width:12px;height:12px;"></span> ${esc(t('settings_status_checking'))}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-action="close-modal">${esc(t('settings_close'))}</button>
      <button type="button" class="btn btn-primary" id="save-settings-btn">${esc(t('settings_save'))}</button>
    </div>
  `);

  checkConnection();

  document.getElementById('save-settings-btn').addEventListener('click', () => {
    const val = document.getElementById('api-base-input').value.trim();
    if (val) setApiBase(val);
    checkConnection();
    render();
  });
}

async function checkConnection() {
  const box = document.getElementById('conn-status');
  if (!box) return;
  box.innerHTML = `<span class="spinner" style="width:12px;height:12px;"></span> ${esc(t('settings_status_checking'))}`;
  try {
    const testBase = document.getElementById('api-base-input') ? document.getElementById('api-base-input').value.trim() : getApiBase();
    const res = await fetch(`${testBase}/health`);
    const ok = res.ok;
    box.innerHTML = `<span class="status-dot ${ok ? 'ok' : 'bad'}"></span> ${ok ? esc(t('settings_status_ok')) : esc(t('settings_status_bad'))}`;
  } catch {
    box.innerHTML = `<span class="status-dot bad"></span> ${esc(t('settings_status_bad'))}`;
  }
}

/* ---------------- Modal helpers ---------------- */
function openModal(innerHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${innerHtml}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  document.addEventListener('keydown', escCloseHandler);
}

function escCloseHandler(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', escCloseHandler);
}

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(message) {
  let el = document.getElementById('gt-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gt-toast';
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--bg-elevated);border:1px solid var(--accent-dim);color:var(--text);padding:12px 20px;border-radius:8px;z-index:200;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,0.4);';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2400);
}

/* ---------------- Error mapping ---------------- */
function errorMessage(e) {
  if (e instanceof ApiError) {
    if (e.status === 0) return t('err_network');
    if (typeof e.message === 'string' && e.message !== 'generic') return e.message;
    return t('err_generic');
  }
  return t('err_generic');
}

/* ---------------- Layout wrapper ---------------- */
function layout(mainHtml) {
  const route = currentRoute();
  document.body.className = document.body.className.replace(/\bpage-\S+/g, '').trim();
  document.body.classList.add('page-' + route.name);
  return `
    <div class="app-shell">
      ${renderTopbar()}
      <main>${mainHtml}</main>
      <footer>${esc(t('footer_text'))}</footer>
    </div>
  `;
}

/* ---------------- Global event delegation ---------------- */
let handlersBound = false;
function bindGlobalHandlers() {
  if (handlersBound) return;
  handlersBound = true;

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'nav') { navigate(el.dataset.hash); }
    else if (action === 'lang') { setLang(el.dataset.lang); render(); }
    else if (action === 'logout') { clearSession(); navigate('#/'); }
    else if (action === 'open-settings') { openSettingsModal(); }
    else if (action === 'close-modal') { closeModal(); }
    else if (action === 'filter') {
      state.filters[el.dataset.field] = el.dataset.value;
      loadDestinations().then(() => {
        document.querySelectorAll(`[data-field="${el.dataset.field}"]`).forEach(c => c.classList.remove('active'));
        el.classList.add('active');
      });
    }
    else if (action === 'toggle-cart') {
      const id = Number(el.dataset.id);
      if (state.cart.has(id)) state.cart.delete(id);
      else {
        const d = state.destCache.get(id) || state.lastDestinations.find(x => x.id === id);
        if (d) state.cart.set(id, d);
      }
      if (el.dataset.refreshModal) { closeModal(); openNewTripModal(); }
      else {
        const card = el.closest('.dest-card');
        if (card) {
          const d = state.destCache.get(id);
          if (d) card.outerHTML = destCard(d);
        } else if (currentDestDetailId != null && state.destCache.has(id)) {
          // Le bouton "ajouter au voyage" de la page détail destination
          // n'est pas dans une .dest-card : on repeint toute la fiche.
          paintDestinationDetail(id);
        }
        renderCartBar();
      }
    }
    else if (action === 'clear-cart') { state.cart.clear(); renderCartBar(); document.querySelectorAll('.dest-card').forEach(c => {}); loadDestinations(); }
    else if (action === 'switch-dest-tab') {
      state.destDetailTab = el.dataset.category;
      if (currentDestDetailId != null) paintDestinationDetail(currentDestDetailId);
    }
    else if (action === 'carousel-prev') {
      const carousel = el.closest('.dest-detail-carousel');
      const slides = Array.from(carousel.querySelectorAll('[data-slide]'));
      const dots = Array.from(carousel.querySelectorAll('[data-action="carousel-dot"]'));
      let current = slides.findIndex(s => s.classList.contains('active'));
      if (current < 0) current = 0;
      current = (current - 1 + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('active', i === current));
      dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
    }
    else if (action === 'carousel-next') {
      const carousel = el.closest('.dest-detail-carousel');
      const slides = Array.from(carousel.querySelectorAll('[data-slide]'));
      const dots = Array.from(carousel.querySelectorAll('[data-action="carousel-dot"]'));
      let current = slides.findIndex(s => s.classList.contains('active'));
      if (current < 0) current = 0;
      current = (current + 1) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('active', i === current));
      dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
    }
    else if (action === 'carousel-dot') {
      const carousel = el.closest('.dest-detail-carousel');
      const slides = Array.from(carousel.querySelectorAll('[data-slide]'));
      const dots = Array.from(carousel.querySelectorAll('[data-action="carousel-dot"]'));
      const idx = Number(el.dataset.index);
      slides.forEach((s, i) => s.classList.toggle('active', i === idx));
      dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
    }
    else if (action === 'delete-media') {
      if (currentDestDetailId == null) return;
      if (!confirm(t('dest_admin_delete_confirm'))) return;
      const mediaId = el.dataset.mediaId;
      api.deleteDestinationMedia(currentDestDetailId, mediaId)
        .then(() => api.getDestination(currentDestDetailId))
        .then((refreshed) => {
          state.destCache.set(refreshed.id, refreshed);
          paintDestinationDetail(refreshed.id);
        })
        .catch((err) => alert(errorMessage(err)));
    }
    else if (action === 'explore-category') {
      state.filters.category = el.dataset.category;
      navigate('#/explore');
    }
    else if (action === 'open-new-trip') { openNewTripModal(); }
    else if (action === 'open-edit-trip') { openEditTripModal(el.dataset.id); }
    else if (action === 'open-share-trip') { openShareTripModal(el.dataset.id); }
    else if (action === 'delete-trip') { deleteTrip(el.dataset.id); }
  });
}

/* ---------------- Router ---------------- */
function currentRoute() {
  const hash = location.hash || '#/';
  if (hash === '#/' || hash === '') return { name: 'home' };
  if (hash === '#/explore') return { name: 'explore' };
  if (hash === '#/login') return { name: 'login' };
  if (hash === '#/register') return { name: 'register' };
  if (hash === '#/trips') return { name: 'trips' };
  const mTrip = hash.match(/^#\/trips\/(\d+)$/);
  if (mTrip) return { name: 'trip-detail', id: mTrip[1] };
  const mDest = hash.match(/^#\/destinations\/(\d+)$/);
  if (mDest) return { name: 'destination-detail', id: mDest[1] };
  return { name: 'home' };
}

function render() {
  const route = currentRoute();
  const needsAuth = route.name === 'trips' || route.name === 'trip-detail';
  if (needsAuth && !isLoggedIn()) { location.hash = '#/login'; return; }

  if (route.name === 'home') renderHome();
  else if (route.name === 'explore') renderExplore();
  else if (route.name === 'login') renderLogin();
  else if (route.name === 'register') renderRegister();
  else if (route.name === 'trips') renderTrips();
  else if (route.name === 'trip-detail') renderTripDetail(route.id);
  else if (route.name === 'destination-detail') renderDestinationDetail(route.id);
}

window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('lang', getLang());
  render();
});
