import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import LoginModal from '../../auth/LoginModal/LoginModal';
import RegisterModal from '../../auth/RegisterModal/RegisterModal';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
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
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-left">
          <NavLink to="/" className="navbar-logo">Atenea Courses</NavLink>
          <ul className="navbar-links">
            <li><NavLink to="/explorer" className={({ isActive }) => isActive ? 'active' : ''}>Explorar</NavLink></li>
            <li><NavLink to="/explorer" className="">Masterclasses</NavLink></li>
            <li><NavLink to="/explorer" className="">Instructores</NavLink></li>
            <li><NavLink to="/membership" className={({ isActive }) => isActive ? 'active' : ''}>Membresía</NavLink></li>
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
                    to="/membership"
                    className="user-dropdown-item"
                    onClick={() => setShowDropdown(false)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>workspace_premium</span>
                    Membresía
                  </NavLink>
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
              <button className="navbar-signin-btn" onClick={() => setShowLogin(true)}>
                Iniciar sesión
              </button>
              <button
                className="navbar-icon-btn"
                onClick={() => setShowRegister(true)}
                title="Crear cuenta"
              >
                <span className="material-symbols-outlined">account_circle</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSwitchToRegister={() => { setShowLogin(false); setShowRegister(true); }}
        />
      )}
      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true); }}
        />
      )}
    </>
  );
};

export default Navbar;
