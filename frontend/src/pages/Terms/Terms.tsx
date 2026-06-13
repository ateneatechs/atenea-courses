import React from 'react';
import './Terms.css';

const Terms: React.FC = () => (
  <div className="terms">
    <div className="terms-header">
      <span className="terms-eyebrow">Información legal</span>
      <h1 className="terms-title">Términos y Condiciones</h1>
      <p className="terms-updated">Última actualización: junio de 2026</p>
    </div>

    <div className="terms-content">
      <p>
        Bienvenido/a a Atenea Courses ("Atenea", "la Plataforma", "nosotros"). Estos Términos y
        Condiciones regulan el acceso y uso de la Plataforma por parte de academias, instructores
        y estudiantes ("Usuarios"). Al registrarte o utilizar la Plataforma, aceptás estos
        términos en su totalidad. Si no estás de acuerdo, no debés utilizar el servicio.
      </p>

      <h2>1. Quiénes somos</h2>
      <p>
        Atenea Courses es un proyecto de tecnología en etapa inicial (startup), operado desde
        Argentina, que provee una plataforma de software como servicio (SaaS) para que academias
        e instructores creen, administren y comercialicen sus propios cursos en línea bajo su
        propia marca. Al momento de esta versión, Atenea aún no se encuentra constituida como
        sociedad (no es una S.R.L. ni otro tipo societario), operando como un proyecto en
        desarrollo. Esta información se actualizará a medida que la estructura legal del proyecto
        evolucione. Para cualquier consulta, podés escribirnos a{' '}
        <a href="mailto:ateneatechs@gmail.com">ateneatechs@gmail.com</a>.
      </p>

      <h2>2. Descripción del servicio</h2>
      <p>
        La Plataforma permite que cada academia ("Tenant") cuente con su propio espacio dentro de
        Atenea Courses, con su marca, contenidos y alumnos. Atenea actúa exclusivamente como{' '}
        <strong>intermediario tecnológico</strong>: provee la infraestructura para alojar cursos,
        gestionar usuarios y procesar pagos, pero no produce, supervisa ni garantiza el contenido
        educativo publicado por cada academia.
      </p>
      <p>
        Cada academia es responsable de la calidad, veracidad, legalidad y actualización de los
        cursos, materiales y promociones que publica, así como del cumplimiento de la Ley de
        Defensa del Consumidor (Ley N.º 24.240) y demás normativa aplicable a su actividad frente
        a los estudiantes que adquieren sus cursos.
      </p>

      <h2>3. Cuentas de usuario</h2>
      <p>
        Para utilizar ciertas funciones de la Plataforma debés crear una cuenta, proporcionando
        información veraz y manteniéndola actualizada. Sos responsable de la confidencialidad de
        tu contraseña y de toda actividad realizada desde tu cuenta. Debés notificarnos de
        inmediato ante cualquier uso no autorizado.
      </p>
      <p>
        Para registrarte es necesario ser mayor de edad (18 años) o contar con la autorización de
        tu padre, madre o tutor legal, conforme al Código Civil y Comercial de la Nación.
      </p>

      <h2>4. Pagos y comisiones</h2>
      <p>
        Los pagos de cursos se procesan a través de Mercado Pago. Cuando una academia conecta su
        propia cuenta de Mercado Pago, los pagos de sus estudiantes se acreditan directamente en
        dicha cuenta, y Atenea retiene automáticamente una comisión por el uso de la Plataforma
        sobre cada transacción. Atenea no almacena datos de tarjetas ni medios de pago: estos son
        gestionados íntegramente por Mercado Pago conforme a sus propios términos y políticas.
      </p>
      <p>
        Las consultas, reclamos o solicitudes de reembolso sobre un curso específico deben
        dirigirse en primer lugar a la academia correspondiente, sin perjuicio de que Atenea pueda
        colaborar para facilitar su resolución.
      </p>

      <h2>5. Propiedad intelectual</h2>
      <p>
        Los contenidos, marcas, logos y materiales subidos por cada academia son de su propiedad o
        de quien corresponda según la ley de Propiedad Intelectual (Ley N.º 11.723), y su uso por
        parte de los estudiantes se limita al acceso personal para fines educativos, sin derecho a
        reproducir, distribuir o comercializar dicho contenido. El software, diseño y marca de
        Atenea Courses son propiedad de Atenea y no pueden utilizarse sin autorización.
      </p>

      <h2>6. Protección de datos personales</h2>
      <p>
        Atenea trata los datos personales de los Usuarios conforme a la Ley N.º 25.326 de
        Protección de Datos Personales y normativa complementaria de la Agencia de Acceso a la
        Información Pública (AAIP). Los datos se utilizan exclusivamente para el funcionamiento de
        la Plataforma (gestión de cuentas, cursos, progreso y pagos) y no se comparten con
        terceros salvo lo necesario para prestar el servicio (por ejemplo, Mercado Pago para
        procesar pagos). Podés solicitar acceso, rectificación o eliminación de tus datos
        escribiendo a <a href="mailto:ateneatechs@gmail.com">ateneatechs@gmail.com</a>.
      </p>

      <h2>7. Limitación de responsabilidad</h2>
      <p>
        La Plataforma se ofrece "tal cual" y "según disponibilidad". Al ser un proyecto en etapa
        inicial, Atenea no garantiza disponibilidad ininterrumpida ni ausencia total de errores, y
        hará sus mejores esfuerzos para resolver cualquier inconveniente a la brevedad. En la
        medida permitida por la ley, Atenea no será responsable por daños indirectos derivados del
        uso de la Plataforma o del contenido publicado por las academias.
      </p>

      <h2>8. Modificaciones</h2>
      <p>
        Podemos actualizar estos Términos y Condiciones para reflejar cambios en el servicio o en
        la normativa aplicable. Las modificaciones relevantes serán comunicadas a través de la
        Plataforma. El uso continuado del servicio luego de dichas modificaciones implica su
        aceptación.
      </p>

      <h2>9. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos y Condiciones se rigen por las leyes de la República Argentina. Cualquier
        controversia que no pueda resolverse de forma amistosa será sometida a los tribunales
        ordinarios competentes de la Ciudad Autónoma de Buenos Aires, sin perjuicio de las normas
        de protección al consumidor que resulten aplicables.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Ante cualquier duda sobre estos Términos y Condiciones, podés escribirnos a{' '}
        <a href="mailto:ateneatechs@gmail.com">ateneatechs@gmail.com</a>.
      </p>
    </div>
  </div>
);

export default Terms;
