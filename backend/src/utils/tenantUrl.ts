// Builds the public frontend URL for a tenant. In production each tenant
// has its own subdomain; in development the SPA is served from a single
// FRONTEND_URL and the tenant is selected via VITE_DEV_TENANT.
export const getTenantFrontendUrl = (slug: string): string => {
  if (process.env.NODE_ENV === 'production') {
    return `https://${slug}.atenea-courses.com`;
  }
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};
