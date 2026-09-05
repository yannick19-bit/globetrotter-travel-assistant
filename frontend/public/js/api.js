const API_BASE_KEY = 'gt_api_base';
const TOKEN_KEY = 'gt_token';
const USER_KEY = 'gt_user';

export function getApiBase() {
  return localStorage.getItem(API_BASE_KEY) || 'http://localhost:3000';
}

export function setApiBase(url) {
  localStorage.setItem(API_BASE_KEY, url.replace(/\/+$/, ''));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new ApiError('network', 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    throw new ApiError((data && data.error) || 'generic', res.status);
  }
  return data;
}

export const api = {
  health: () => request('/health'),

  register: (full_name, email, password) =>
    request('/api/auth/register', { method: 'POST', body: { full_name, email, password } }),

  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),

  searchDestinations: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const query = qs.toString();
    return request(`/api/destinations${query ? `?${query}` : ''}`);
  },

  getDestination: (id) => request(`/api/destinations/${id}`),

  listItineraries: () => request('/api/itineraries', { auth: true }),

  getItinerary: (id) => request(`/api/itineraries/${id}`, { auth: true }),

  createItinerary: (payload) =>
    request('/api/itineraries', { method: 'POST', body: payload, auth: true }),

  updateItinerary: (id, payload) =>
    request(`/api/itineraries/${id}`, { method: 'PUT', body: payload, auth: true }),

  deleteItinerary: (id) =>
    request(`/api/itineraries/${id}`, { method: 'DELETE', auth: true }),

  shareItinerary: (id, shared_with_user_id, permission) =>
    request(`/api/itineraries/${id}/share`, {
      method: 'POST',
      body: { shared_with_user_id: Number(shared_with_user_id), permission },
      auth: true
    }),
};

export { ApiError };
