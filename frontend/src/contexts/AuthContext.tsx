import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthResponse } from '../types';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('lumiere-token');
    if (!token) { setIsLoading(false); return; }
    try {
      const { data } = await api.get<User>('/auth/me');
      setUser(data);
    } catch {
      localStorage.removeItem('lumiere-token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('lumiere-token', data.token);
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/register', { name, email, password });
    localStorage.setItem('lumiere-token', data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('lumiere-token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      login, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
