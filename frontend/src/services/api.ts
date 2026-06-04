import axios from 'axios';

const getTenantSlug = (): string | null => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (!parts[0] || parts[0] === 'super-admin') return null;
  return parts[0];
};

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('atenea-token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;

  const slug = getTenantSlug();
  if (slug) config.headers['X-Tenant-Slug'] = slug;

  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('atenea-token');
    }
    return Promise.reject(error);
  }
);

export default api;
