import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface TenantSettings {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  notFound: boolean;
  membershipEnabled: boolean;
  membershipMonthlyPrice: number;
  membershipAnnualPrice: number;
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
  const [membershipEnabled, setMembershipEnabled] = useState(true);
  const [membershipMonthlyPrice, setMembershipMonthlyPrice] = useState(15000);
  const [membershipAnnualPrice, setMembershipAnnualPrice] = useState(150000);

  const refreshSettings = useCallback(async () => {
    try {
      const { data } = await api.get<{
        site_name: string;
        logo_url: string | null;
        membership_enabled: boolean;
        membership_monthly_price: number;
        membership_annual_price: number;
      }>('/settings/public');
      setTenantName(data.site_name || tenantSlug);
      setLogoUrl(data.logo_url);
      setMembershipEnabled(data.membership_enabled);
      setMembershipMonthlyPrice(data.membership_monthly_price);
      setMembershipAnnualPrice(data.membership_annual_price);
      setNotFound(false);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) {
        setNotFound(true);
      }
    }
  }, [tenantSlug]);

  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  return (
    <TenantContext.Provider value={{
      tenantSlug, tenantName, logoUrl, notFound,
      membershipEnabled, membershipMonthlyPrice, membershipAnnualPrice,
      refreshSettings,
    }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantSettings => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
};
