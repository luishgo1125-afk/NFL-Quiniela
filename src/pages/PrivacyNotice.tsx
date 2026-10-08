import { whatsappUrl } from '../components/HomeSections'

// Si quieres mostrar un correo de contacto en el aviso, escribelo aqui.
const CONTACT_EMAIL = ''
const UPDATED = '7 de octubre de 2026'

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Quién es el responsable',
    body: (
      <p>
        Quiniela (en adelante, "la app") es una aplicación para hacer predicciones de partidos de la NFL con amigos y familia. La persona que la administra es la responsable del tratamiento de tus datos personales y puede ser contactada por los medios indicados al final de este aviso.
      </p>
    ),
  },
  {
    title: '2. Qué datos recopilamos',
    body: (
      <ul>
        <li><b>Datos de cuenta:</b> correo electrónico y contraseña (la contraseña se guarda cifrada; nunca podemos verla).</li>
        <li><b>Datos de perfil:</b> nombre o apodo, equipo favorito y, si la subes, la imagen de tu perfil o de tu liga.</li>
        <li><b>Datos de juego:</b> tus ligas, tus predicciones, tus puntos y tu posición en las tablas.</li>
        <li><b>Datos de pago dentro de la liga:</b> los montos de apuesta o cuota que la liga defina y el registro de quién ha pagado, según lo capture el administrador de cada liga. La app no procesa pagos ni guarda números de tarjeta o cuentas bancarias.</li>
        <li><b>Notificaciones:</b> si las activas, un identificador técnico de tu dispositivo para poder enviarte avisos de partidos y resultados.</li>
        <li><b>Datos técnicos básicos:</b> información que genera el uso normal de cualquier sitio web (por ejemplo, tipo de navegador), necesaria para que la app funcione.</li>
      </ul>
    ),
  },
  {
    title: '3. Para qué los usamos',
    body: (
      <ul>
        <li>Crear y mantener tu cuenta e iniciar tu sesión.</li>
        <li>Calcular puntos y mostrar rankings y tablas, incluido el ranking global.</li>
        <li>Mostrar tu nombre y tus predicciones a los demás miembros de tus ligas.</li>
        <li>Enviarte notificaciones relacionadas con el juego, si las activaste.</li>
        <li>Llevar el control de cuotas y premios dentro de cada liga.</li>
        <li>Mantener la seguridad y el buen funcionamiento de la app.</li>
      </ul>
    ),
  },
  {
    title: '4. Qué es visible para otros usuarios',
    body: (
      <p>
        Tu nombre o apodo, tu equipo favorito, tus puntos y tus predicciones pueden ser vistos por otros miembros de las ligas en las que participas y, en el caso de nombre y puntos, en el ranking global. Tu correo electrónico no se muestra a otros jugadores. Las ligas públicas pueden ser vistas y a ellas puede unirse cualquier persona con cuenta; las privadas solo se pueden unir con código de invitación.
      </p>
    ),
  },
  {
    title: '5. Con quién compartimos tus datos',
    body: (
      <>
        <p>No vendemos ni rentamos tus datos personales. Para operar la app usamos proveedores de servicios que los procesan en nuestro nombre:</p>
        <ul>
          <li><b>Supabase:</b> autenticación y base de datos.</li>
          <li><b>Vercel:</b> alojamiento de la app.</li>
          <li><b>Servicios de notificaciones push</b> del navegador o del dispositivo, si las activas.</li>
        </ul>
        <p>Estos proveedores pueden almacenar la información en servidores ubicados fuera de tu país, incluido Estados Unidos. También podríamos divulgar datos si una autoridad competente lo exige conforme a la ley.</p>
      </>
    ),
  },
  {
    title: '6. Cuánto tiempo los conservamos',
    body: <p>Conservamos tus datos mientras tengas una cuenta activa. Si solicitas la eliminación de tu cuenta, borraremos o anonimizaremos tus datos personales, salvo los que debamos conservar por una obligación legal.</p>,
  },
  {
    title: '7. Tus derechos',
    body: (
      <>
        <p>Puedes en cualquier momento acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso, así como revocar tu consentimiento (derechos ARCO). Puedes editar tu nombre y tu equipo favorito desde tu perfil. Para ejercer cualquier otro derecho, o para solicitar que se elimine tu cuenta, contáctanos por los medios de la sección 10.</p>
        <p>Puedes desactivar las notificaciones en cualquier momento desde la configuración de tu navegador o dispositivo.</p>
      </>
    ),
  },
  {
    title: '8. Seguridad',
    body: <p>Aplicamos medidas técnicas razonables para proteger tu información, como conexiones cifradas y control de acceso a la base de datos. Aun así, ningún sistema es completamente infalible; te recomendamos usar una contraseña única y no compartirla.</p>,
  },
  {
    title: '9. Menores de edad',
    body: <p>La app está pensada para personas mayores de edad. Si eres menor de edad, necesitas el consentimiento de tu madre, padre o tutor para usarla.</p>,
  },
  {
    title: '10. Contacto',
    body: (
      <p>
        Para dudas, solicitudes de acceso, corrección o eliminación de datos, escríbenos por{' '}
        <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        {CONTACT_EMAIL && <> o al correo <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></>}.
      </p>
    ),
  },
  {
    title: '11. Cambios a este aviso',
    body: <p>Podemos actualizar este aviso cuando cambie la app o la ley aplicable. La fecha de la última actualización aparece al inicio. Si hacemos cambios importantes, lo avisaremos dentro de la app.</p>,
  },
]

export default function PrivacyNotice() {
  function back() {
    // si se abrio en otra pestaña, la cierra; si no, regresa al inicio
    if (window.history.length <= 1) window.close()
    window.location.hash = ''
  }
  return (
    <div className="page-wrap narrow privacy-page">
      <button onClick={back} className="privacy-back">← Volver</button>
      <h1 className="privacy-h1">Aviso de privacidad</h1>
      <p className="privacy-updated">Última actualización: {UPDATED}</p>
      <p className="privacy-lead">
        Tu privacidad es importante. Este aviso explica de forma sencilla qué datos personales recopila Quiniela, para qué los usa y qué puedes hacer con ellos.
      </p>
      {sections.map((s) => (
        <section key={s.title} className="privacy-sec">
          <h2>{s.title}</h2>
          {s.body}
        </section>
      ))}
    </div>
  )
}
