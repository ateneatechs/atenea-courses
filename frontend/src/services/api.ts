import axios from 'axios';
import { getTenantSlug } from '../utils/tenant';

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
