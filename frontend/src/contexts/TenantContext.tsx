import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface TenantSettings {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  notFound: boolean;
  refreshSettings: () => Promise<void>;
}

const TenantContext = createContext<TenantSettings | undefined>(undefined);

export const TenantProvider: React.FC<{
  tenantSlug: string;
  children: React.ReactNode;
}> = ({ tenantSlug, children }) => {
  const [tenantName, setTenantName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const refreshSettings = useCallback(async () => {
    try {
      const { data } = await api.get<{ site_name: string; logo_url: string | null }>(
        '/settings/public'
      );
      setTenantName(data.site_name || tenantSlug);
      setLogoUrl(data.logo_url);
      setNotFound(false);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) {
        setNotFound(true);
      }
    }
  }, [tenantSlug]);

  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  return (
    <TenantContext.Provider value={{ tenantSlug, tenantName, logoUrl, notFound, refreshSettings }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantSettings => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
};
