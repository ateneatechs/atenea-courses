export function getTenantSlug(): string | null {
  // Single-tenant / dedicated-domain deploys: force a fixed tenant regardless
  // of the hostname (e.g. nazabarber.com → "naza-barber").
  const forced = import.meta.env.VITE_DEFAULT_TENANT as string | undefined;
  if (forced) return forced;

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_DEV_TENANT || null;
  }
  // naza-barber.atenea-courses.com → "naza-barber"
  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : null;
}
