import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import '../LoginModal/LoginModal.css';

interface Props {
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const RegisterModal: React.FC<Props> = ({ onClose, onSwitchToLogin }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones para crear una cuenta.');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Error al registrarse. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ position: 'relative' }}>
        <button className="modal-close" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="modal-header">
          <span className="modal-label">Únete a la Academia</span>
          <h2 className="modal-title">Crea tu cuenta</h2>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="reg-name">Nombre completo</label>
            <input
              id="reg-name"
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              required autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="reg-email">Correo electrónico</label>
            <input
              id="reg-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="reg-password">Contraseña</label>
            <input
              id="reg-password"
              type="password"
              placeholder="Mín. 8 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required minLength={8}
            />
          </div>

          <div className="form-checkbox-field">
            <input
              id="reg-terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)}
              required
            />
            <label htmlFor="reg-terms">
              Acepto los{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Términos y Condiciones
              </a>
            </label>
          </div>

          {error && <div className="modal-error">{error}</div>}

          <button type="submit" className="modal-submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <div className="modal-switch">
            ¿Ya tienes cuenta?{' '}
            <button type="button" onClick={onSwitchToLogin}>Inicia sesión</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterModal;
