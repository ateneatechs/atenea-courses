import React from 'react';
import '../Explorer/Explorer.css';
import './Legal.css';

const PrivacyPolicy: React.FC = () => (
  <div className="explorer">
    <header className="explorer-header">
      <h1 className="explorer-title">Política de Privacidad</h1>
    </header>

    <div className="legal-content">
      <p className="legal-updated">Última actualización: 28 de julio de 2026.</p>

      <h2>1. Quiénes somos</h2>
      <p>
        Atenea Courses es una plataforma de cursos online. A los efectos de esta Política,
        aclaramos expresamente que Atenea Courses <strong>no se encuentra constituida como una
        Sociedad de Responsabilidad Limitada (SRL) ni bajo ninguna otra figura societaria
        registrada</strong>. Es un proyecto operado de forma independiente por sus responsables,
        quienes actúan como administradores operativos de este sitio y de los datos que se
        describen a continuación.
      </p>

      <h2>2. Datos que recopilamos</h2>
      <ul>
        <li>Datos de cuenta: nombre, correo electrónico y contraseña (almacenada de forma cifrada, nunca en texto plano).</li>
        <li>Datos de uso: progreso en los cursos, lecciones completadas y avance de reproducción de video.</li>
        <li>Datos de pago: los pagos se procesan a través de Mercado Pago. No almacenamos números de tarjeta ni datos financieros sensibles en nuestros servidores.</li>
        <li>Datos técnicos: dirección IP, tipo de navegador y cookies o almacenamiento local estrictamente necesarios para el funcionamiento del sitio (por ejemplo, el token de sesión).</li>
      </ul>

      <h2>3. Uso de los datos</h2>
      <p>Utilizamos tus datos únicamente para:</p>
      <ul>
        <li>Darte acceso a los cursos comprados o incluidos en tu membresía.</li>
        <li>Procesar pagos y enviarte confirmaciones por correo electrónico.</li>
        <li>Mejorar la plataforma y resolver problemas técnicos.</li>
        <li>Responder tus consultas de soporte.</li>
      </ul>
      <p>No vendemos ni alquilamos tus datos personales a terceros con fines de marketing.</p>

      <h2>4. Compartición con terceros</h2>
      <p>Compartimos información limitada, y solo la estrictamente necesaria, con:</p>
      <ul>
        <li>Mercado Pago, para procesar pagos y suscripciones.</li>
        <li>Proveedores de infraestructura (hosting y base de datos) necesarios para operar el sitio.</li>
      </ul>

      <h2>5. Seguridad</h2>
      <p>
        Tomamos medidas razonables (contraseñas cifradas, conexión HTTPS) para proteger tu
        información. Sin embargo, ningún sistema es completamente infalible, y el uso de la
        plataforma implica la aceptación de ese riesgo inherente a cualquier servicio online.
      </p>

      <h2>6. Tus derechos</h2>
      <p>
        Podés solicitar en cualquier momento el acceso a tus datos, la corrección de datos
        incorrectos, o la eliminación de tu cuenta y de los datos asociados. Para ejercer estos
        derechos, escribinos a{' '}
        <a href="mailto:ateneatechs@gmail.com">ateneatechs@gmail.com</a>.
      </p>

      <h2>7. Retención de datos</h2>
      <p>
        Conservamos tus datos mientras tu cuenta esté activa. Si solicitás la eliminación de tu
        cuenta, eliminaremos o anonimizaremos tus datos personales dentro de un plazo razonable,
        salvo que debamos conservar cierta información por obligaciones legales, contables o
        para prevenir fraude.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        La plataforma está dirigida a mayores de 18 años. No recopilamos intencionalmente datos
        de menores de edad.
      </p>

      <h2>9. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta Política de Privacidad periódicamente. Cualquier cambio se
        publicará en esta misma página junto con la fecha de última actualización.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Ante cualquier duda sobre esta Política de Privacidad, escribinos a{' '}
        <a href="mailto:ateneatechs@gmail.com">ateneatechs@gmail.com</a>.
      </p>
    </div>
  </div>
);

export default PrivacyPolicy;
