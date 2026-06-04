export function getTenantSlug(): string | null {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_DEV_TENANT || null;
  }
  // naza-barber.atenea-courses.com → "naza-barber"
  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : null;
}
