import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL,
  timeout: 60000, // AI calls can be slow
});

const TOKEN_KEY = 'studybuddy.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response?.status === 401) {
      const here = window.location.pathname;
      // Avoid infinite loop on the login page itself.
      if (!here.startsWith('/login') && !here.startsWith('/signup')) {
        setToken(null);
        // Use replace so back button doesn't bounce them back.
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function apiError(err) {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    // FastAPI/Pydantic 422: detail is [{loc, msg, type}, ...].
    // Surface the human-readable msg instead of stringifying objects.
    return detail
      .map((d) => (d && typeof d === 'object' ? d.msg || JSON.stringify(d) : String(d)))
      .join(', ');
  }
  if (typeof detail === 'string') return detail;
  return err?.message || 'Something went wrong';
}
