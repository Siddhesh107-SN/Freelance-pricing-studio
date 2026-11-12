import axios from 'axios';

export const TOKEN_KEY = 'fps_token';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 20000 });

const detail = (data) => {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => `${(x.loc || []).slice(1).join('.')}: ${x.msg}`).join('; ');
  return null;
};

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (!err.response) {
      err.userMessage = 'Cannot reach the server. Check that the backend is running. Your work is still saved on this device.';
    } else if (err.response.status === 401 && !String(err.config?.url).includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('auth:expired'));
      err.userMessage = 'Your session expired. Sign in again.';
    } else {
      err.userMessage = detail(err.response.data) || `Request failed (${err.response.status}).`;
    }
    return Promise.reject(err);
  },
);

export const errorMessage = (e) => e?.userMessage || e?.message || 'Something went wrong.';
export default api;
