import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer: React.FC = () => (
  <footer className="footer">
    <div className="footer-main">
      <div className="footer-top">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">Atenea Courses</Link>
          <p className="footer-tagline">
            La plataforma de educación premium para barberos profesionales. Técnica, arte y negocio en un solo lugar.
          </p>
          <div className="footer-socials">
            <a
              className="footer-social-btn"
              title="Instagram"
              href="https://www.instagram.com/ateneatechs/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-brands fa-instagram" aria-hidden="true"></i>
            </a>
            <a className="footer-social-btn" title="Correo" href="mailto:ateneatechs@gmail.com">
              <i className="fa-solid fa-envelope" aria-hidden="true"></i>
            </a>
          </div>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <span className="footer-col-title">Explorar</span>
            <Link to="/explorer">Cursos</Link>
            <Link to="/explorer">Instructores</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Soporte</span>
            <Link to="/terms">Términos y condiciones</Link>
            <a href="mailto:ateneatechs@gmail.com">Contactar soporte</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">© {new Date().getFullYear()} Atenea Courses. Todos los derechos reservados.</p>
        <div className="footer-bottom-links">
          <a href="https://www.instagram.com/ateneatechs/" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="mailto:ateneatechs@gmail.com">Contacto</a>
          <Link to="/terms">Términos y condiciones</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
