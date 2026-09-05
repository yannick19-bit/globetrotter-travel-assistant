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
        <a href="#/" class="nav-link ${route.name === 'explore' ? 'active' : ''}" data-action="nav" data-hash="#/">${esc(t('nav_explore'))}</a>
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
    data.destinations.forEach(d => state.destCache.set(d.id, d));
    if (data.destinations.length === 0) {
      results.innerHTML = `<div class="empty-state"><h3>${esc(t('no_destinations'))}</h3><p>${esc(t('no_destinations_hint'))}</p></div>`;
      return;
    }
    results.innerHTML = `<div class="dest-grid">${data.destinations.map(destCard).join('')}</div>`;
  } catch (e) {
    results.innerHTML = `<div class="alert alert-error">${esc(errorMessage(e))}</div>`;
  }
}

function destCard(d) {
  const inCart = state.cart.has(d.id);
  return `
    <article class="dest-card">
      <div class="dest-card-top">
        <div>
          <p class="dest-name">${esc(d.name)}</p>
          <p class="dest-country">${esc(d.country)}</p>
        </div>
        <span class="dest-code">${codeFor(d.name)}</span>
      </div>
      <p class="dest-desc">${esc(d.description || '')}</p>
      <div class="dest-meta">
        <span class="tag">${esc(t('cat_' + d.category))}</span>
        <span class="tag budget-${esc(d.budget_level)}">${esc(t('budget_' + d.budget_level))}</span>
        <span class="tag">${esc(t('popularity'))} ${esc(d.popularity_score)}</span>
      </div>
      <div class="dest-actions">
        <button class="btn ${inCart ? 'btn-secondary' : 'btn-primary'} btn-block btn-sm" data-action="toggle-cart" data-id="${d.id}">
          ${inCart ? '✓ ' + esc(t('added')) : esc(t('add_to_trip'))}
        </button>
      </div>
    </article>
  `;
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
        }
        renderCartBar();
      }
    }
    else if (action === 'clear-cart') { state.cart.clear(); renderCartBar(); document.querySelectorAll('.dest-card').forEach(c => {}); loadDestinations(); }
    else if (action === 'open-new-trip') { openNewTripModal(); }
    else if (action === 'open-edit-trip') { openEditTripModal(el.dataset.id); }
    else if (action === 'open-share-trip') { openShareTripModal(el.dataset.id); }
    else if (action === 'delete-trip') { deleteTrip(el.dataset.id); }
  });
}

/* ---------------- Router ---------------- */
function currentRoute() {
  const hash = location.hash || '#/';
  if (hash === '#/' || hash === '') return { name: 'explore' };
  if (hash === '#/login') return { name: 'login' };
  if (hash === '#/register') return { name: 'register' };
  if (hash === '#/trips') return { name: 'trips' };
  const m = hash.match(/^#\/trips\/(\d+)$/);
  if (m) return { name: 'trip-detail', id: m[1] };
  return { name: 'explore' };
}

function render() {
  const route = currentRoute();
  const needsAuth = route.name === 'trips' || route.name === 'trip-detail';
  if (needsAuth && !isLoggedIn()) { location.hash = '#/login'; return; }

  if (route.name === 'explore') renderExplore();
  else if (route.name === 'login') renderLogin();
  else if (route.name === 'register') renderRegister();
  else if (route.name === 'trips') renderTrips();
  else if (route.name === 'trip-detail') renderTripDetail(route.id);
}

window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('lang', getLang());
  render();
});
