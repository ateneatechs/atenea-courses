import React, { createContext, useContext, useState } from 'react';

interface AuthModalContextType {
  showLogin: boolean;
  showRegister: boolean;
  openLogin: () => void;
  openRegister: () => void;
  closeModals: () => void;
  switchToRegister: () => void;
  switchToLogin: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

// Lets any page (e.g. a locked course's purchase gate) open the login/register
// modal directly, instead of navigating away and losing the user's place.
export const AuthModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  return (
    <AuthModalContext.Provider value={{
      showLogin,
      showRegister,
      openLogin: () => { setShowRegister(false); setShowLogin(true); },
      openRegister: () => { setShowLogin(false); setShowRegister(true); },
      closeModals: () => { setShowLogin(false); setShowRegister(false); },
      switchToRegister: () => { setShowLogin(false); setShowRegister(true); },
      switchToLogin: () => { setShowRegister(false); setShowLogin(true); },
    }}>
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = (): AuthModalContextType => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
};
