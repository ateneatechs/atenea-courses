import React from 'react';
import '../Explorer/Explorer.css';
import './Legal.css';

const TermsOfService: React.FC = () => (
  <div className="explorer">
    <header className="explorer-header">
      <h1 className="explorer-title">Términos de Servicio</h1>
    </header>

    <div className="legal-content">
      <p className="legal-updated">Última actualización: 28 de julio de 2026.</p>

      <h2>1. Aceptación de los términos</h2>
      <p>
        Al crear una cuenta o utilizar Atenea Courses ("la Plataforma"), aceptás estos Términos
        de Servicio en su totalidad. Si no estás de acuerdo con alguno de sus puntos, no debés
        utilizar la Plataforma.
      </p>

      <h2>2. Sobre quién opera la Plataforma</h2>
      <p>
        Atenea Courses es un proyecto operado de forma independiente. <strong>No se encuentra
        constituido como una Sociedad de Responsabilidad Limitada (SRL) ni bajo ninguna otra
        figura societaria registrada.</strong> Estos Términos regulan la relación entre vos y
        quienes administran la Plataforma, en su carácter de responsables operativos del
        servicio, y no deben interpretarse como una relación con una persona jurídica formalmente
        constituida.
      </p>

      <h2>3. Descripción del servicio</h2>
      <p>
        La Plataforma ofrece cursos en video, materiales educativos y, cuando estén disponibles,
        membresías de acceso a contenido. El contenido, los precios y la disponibilidad de los
        cursos pueden modificarse sin previo aviso.
      </p>

      <h2>4. Cuentas de usuario</h2>
      <ul>
        <li>Sos responsable de mantener la confidencialidad de tu contraseña.</li>
        <li>Debés proporcionar información veraz al registrarte.</li>
        <li>Nos reservamos el derecho de suspender o eliminar cuentas que incumplan estos Términos.</li>
      </ul>

      <h2>5. Compras, precios y pagos</h2>
      <ul>
        <li>Los precios se muestran en pesos argentinos (ARS) y pueden cambiar sin previo aviso.</li>
        <li>Los pagos se procesan a través de Mercado Pago; al pagar, también aceptás los términos de dicho proveedor.</li>
        <li>Salvo que se indique lo contrario, el acceso a un curso comprado individualmente es de carácter permanente ("de por vida"), mientras la Plataforma continúe operativa.</li>
        <li>Las suscripciones de membresía se renuevan según el plan elegido y pueden cancelarse en cualquier momento; la cancelación no genera reembolsos proporcionales del período ya abonado, salvo que la normativa aplicable disponga lo contrario.</li>
      </ul>

      <h2>6. Reembolsos</h2>
      <p>
        Dada la naturaleza digital del contenido, las compras no son reembolsables una vez
        otorgado el acceso al curso, salvo error de facturación comprobado o disposición legal en
        contrario. Ante cualquier inconveniente, escribinos a{' '}
        <a href="mailto:ateneatechs@gmail.com">ateneatechs@gmail.com</a> y evaluaremos cada caso
        particular.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        Todo el contenido de los cursos (videos, materiales, textos y marcas) es propiedad de la
        Plataforma o de sus instructores. Al comprar un curso, se te otorga una licencia
        personal, intransferible y no exclusiva para uso educativo individual. Queda prohibido
        compartir, revender, redistribuir o publicar el contenido sin autorización expresa.
      </p>

      <h2>8. Conducta del usuario</h2>
      <p>No está permitido:</p>
      <ul>
        <li>Compartir tu cuenta o tus credenciales de acceso con terceros.</li>
        <li>Intentar vulnerar la seguridad de la Plataforma.</li>
        <li>Utilizar el servicio con fines ilícitos o contrarios a estos Términos.</li>
      </ul>

      <h2>9. Disponibilidad del servicio</h2>
      <p>
        Hacemos nuestro mejor esfuerzo para mantener la Plataforma disponible, pero no
        garantizamos un funcionamiento ininterrumpido o libre de errores. Podemos realizar
        tareas de mantenimiento que interrumpan temporalmente el acceso.
      </p>

      <h2>10. Limitación de responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley aplicable, la Plataforma y sus operadores no
        serán responsables por daños indirectos, incidentales o consecuentes derivados del uso o
        la imposibilidad de uso del servicio.
      </p>

      <h2>11. Modificaciones</h2>
      <p>
        Podemos modificar estos Términos, los precios o el contenido ofrecido en cualquier
        momento. Los cambios entran en vigencia al publicarse en esta página.
      </p>

      <h2>12. Terminación</h2>
      <p>
        Podés dejar de usar la Plataforma en cualquier momento. Podemos suspender o cancelar tu
        cuenta ante un incumplimiento grave de estos Términos.
      </p>

      <h2>13. Ley aplicable</h2>
      <p>
        Estos Términos se rigen por las leyes de la República Argentina, sin perjuicio de las
        normas de protección al consumidor que resulten aplicables según tu jurisdicción.
      </p>

      <h2>14. Contacto</h2>
      <p>
        Para consultas sobre estos Términos, escribinos a{' '}
        <a href="mailto:ateneatechs@gmail.com">ateneatechs@gmail.com</a>.
      </p>
    </div>
  </div>
);

export default TermsOfService;
