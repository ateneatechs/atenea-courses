import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTenant } from '../../../contexts/TenantContext';
import { useAuthModal } from '../../../contexts/AuthModalContext';
import LoginModal from '../../auth/LoginModal/LoginModal';
import RegisterModal from '../../auth/RegisterModal/RegisterModal';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { tenantName, logoUrl, membershipEnabled } = useTenant();
  const navigate = useNavigate();
  const { showLogin, showRegister, openLogin, openRegister, closeModals, switchToRegister, switchToLogin } = useAuthModal();

  const [scrolled, setScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    setShowMobileMenu(false);
    navigate('/');
  };

  const closeMobileMenu = () => setShowMobileMenu(false);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-left">
          <button
            className="navbar-hamburger"
            onClick={() => setShowMobileMenu(p => !p)}
            aria-label={showMobileMenu ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={showMobileMenu}
          >
            <span className="material-symbols-outlined">{showMobileMenu ? 'close' : 'menu'}</span>
          </button>
          {logoUrl
            ? <NavLink to="/" onClick={closeMobileMenu}><img src={logoUrl} alt={tenantName} className="navbar-logo-img" /></NavLink>
            : <NavLink to="/" className="navbar-logo" onClick={closeMobileMenu}>{tenantName}</NavLink>
          }
          <ul className="navbar-links">
            <li><NavLink to="/explorer" className={({ isActive }) => isActive ? 'active' : ''}>Explorar</NavLink></li>
            <li><NavLink to="/explorer?filter=masterclass" className={({ isActive }) => isActive ? 'active' : ''}>Masterclasses</NavLink></li>
            {membershipEnabled && (
              <li><NavLink to="/membership" className={({ isActive }) => isActive ? 'active' : ''}>Membresía</NavLink></li>
            )}
          </ul>
        </div>

        <div className="navbar-right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {isAuthenticated ? (
            <div className="user-avatar-wrap" ref={dropdownRef}>
              <button className="navbar-avatar" onClick={() => setShowDropdown(p => !p)}>
                {initials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{user?.name}</div>
                    <div className="user-dropdown-email">{user?.email}</div>
                    {isAdmin && <span className="user-dropdown-badge">Admin</span>}
                    {user?.subscription && <span className="user-dropdown-badge">Miembro</span>}
                  </div>
                  {isAdmin && (
                    <button
                      className="user-dropdown-item"
                      onClick={() => { navigate('/admin'); setShowDropdown(false); }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>admin_panel_settings</span>
                      Panel de Admin
                    </button>
                  )}
                  <NavLink
                    to="/mis-cursos"
                    className="user-dropdown-item"
                    onClick={() => setShowDropdown(false)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>video_library</span>
                    Mis Cursos
                  </NavLink>
                  {membershipEnabled && (
                    <NavLink
                      to="/membership"
                      className="user-dropdown-item"
                      onClick={() => setShowDropdown(false)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>workspace_premium</span>
                      Membresía
                    </NavLink>
                  )}
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item danger" onClick={handleLogout}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="navbar-signin-btn" onClick={openLogin} title="Iniciar sesión">
                <span className="material-symbols-outlined navbar-signin-icon">login</span>
                <span className="navbar-signin-label">Iniciar sesión</span>
              </button>
              <button
                className="navbar-icon-btn"
                onClick={openRegister}
                title="Crear cuenta"
              >
                <span className="material-symbols-outlined">account_circle</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {showMobileMenu && (
        <div className="mobile-menu">
          <NavLink to="/explorer" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMobileMenu}>
            Explorar
          </NavLink>
          <NavLink to="/explorer?filter=masterclass" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMobileMenu}>
            Masterclasses
          </NavLink>
          {membershipEnabled && (
            <NavLink to="/membership" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMobileMenu}>
              Membresía
            </NavLink>
          )}
          {isAuthenticated && (
            <>
              <div className="mobile-menu-divider" />
              <NavLink to="/mis-cursos" onClick={closeMobileMenu}>Mis Cursos</NavLink>
              {isAdmin && <NavLink to="/admin" onClick={closeMobileMenu}>Panel de Admin</NavLink>}
              <button className="mobile-menu-link danger" onClick={handleLogout}>Cerrar sesión</button>
            </>
          )}
        </div>
      )}

      {showLogin && (
        <LoginModal onClose={closeModals} onSwitchToRegister={switchToRegister} />
      )}
      {showRegister && (
        <RegisterModal onClose={closeModals} onSwitchToLogin={switchToLogin} />
      )}
    </>
  );
};

export default Navbar;
