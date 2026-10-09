import { whatsappUrl } from '../components/HomeSections'
import { tr, localeTag } from '../i18n'

// Si quieres mostrar un correo de contacto en el aviso, escribelo aqui.
const CONTACT_EMAIL = ''
const UPDATED = new Date(2026, 9, 7)

function getSections(): { title: string; body: React.ReactNode }[] {
  return [
  {
    title: tr('1. Quién es el responsable'),
    body: (
      <p>{tr('Quiniela (en adelante, "la app") es una aplicación para hacer predicciones de partidos de la NFL con amigos y familia. La persona que la administra es la responsable del tratamiento de tus datos personales y puede ser contactada por los medios indicados al final de este aviso.')}</p>
    ),
  },
  {
    title: tr('2. Qué datos recopilamos'),
    body: (
      <ul>
        <li><b>{tr('Datos de cuenta:')}</b> {tr('correo electrónico y contraseña (la contraseña se guarda cifrada; nunca podemos verla).')}</li>
        <li><b>{tr('Datos de perfil:')}</b> {tr('nombre o apodo, equipo favorito y, si la subes, la imagen de tu perfil o de tu liga.')}</li>
        <li><b>{tr('Datos de juego:')}</b> {tr('tus ligas, tus predicciones, tus puntos y tu posición en las tablas.')}</li>
        <li><b>{tr('Datos de pago dentro de la liga:')}</b> {tr('los montos de apuesta o cuota que la liga defina y el registro de quién ha pagado, según lo capture el administrador de cada liga. La app no procesa pagos ni guarda números de tarjeta o cuentas bancarias.')}</li>
        <li><b>{tr('Notificaciones:')}</b> {tr('si las activas, un identificador técnico de tu dispositivo para poder enviarte avisos de partidos y resultados.')}</li>
        <li><b>{tr('Datos técnicos básicos:')}</b> {tr('información que genera el uso normal de cualquier sitio web (por ejemplo, tipo de navegador), necesaria para que la app funcione.')}</li>
      </ul>
    ),
  },
  {
    title: tr('3. Para qué los usamos'),
    body: (
      <ul>
        <li>{tr('Crear y mantener tu cuenta e iniciar tu sesión.')}</li>
        <li>{tr('Calcular puntos y mostrar rankings y tablas, incluido el ranking global.')}</li>
        <li>{tr('Mostrar tu nombre y tus predicciones a los demás miembros de tus ligas.')}</li>
        <li>{tr('Enviarte notificaciones relacionadas con el juego, si las activaste.')}</li>
        <li>{tr('Llevar el control de cuotas y premios dentro de cada liga.')}</li>
        <li>{tr('Mantener la seguridad y el buen funcionamiento de la app.')}</li>
      </ul>
    ),
  },
  {
    title: tr('4. Qué es visible para otros usuarios'),
    body: (
      <p>{tr('Tu nombre o apodo, tu equipo favorito, tus puntos y tus predicciones pueden ser vistos por otros miembros de las ligas en las que participas y, en el caso de nombre y puntos, en el ranking global. Tu correo electrónico no se muestra a otros jugadores. Las ligas públicas pueden ser vistas y a ellas puede unirse cualquier persona con cuenta; las privadas solo se pueden unir con código de invitación.')}</p>
    ),
  },
  {
    title: tr('5. Con quién compartimos tus datos'),
    body: (
      <>
        <p>{tr('No vendemos ni rentamos tus datos personales. Para operar la app usamos proveedores de servicios que los procesan en nuestro nombre:')}</p>
        <ul>
          <li><b>{tr('Supabase:')}</b> {tr('autenticación y base de datos.')}</li>
          <li><b>{tr('Vercel:')}</b> {tr('alojamiento de la app.')}</li>
          <li><b>{tr('Servicios de notificaciones push')}</b> {tr('del navegador o del dispositivo, si las activas.')}</li>
        </ul>
        <p>{tr('Estos proveedores pueden almacenar la información en servidores ubicados fuera de tu país, incluido Estados Unidos. También podríamos divulgar datos si una autoridad competente lo exige conforme a la ley.')}</p>
      </>
    ),
  },
  {
    title: tr('6. Cuánto tiempo los conservamos'),
    body: <p>{tr('Conservamos tus datos mientras tengas una cuenta activa. Si solicitas la eliminación de tu cuenta, borraremos o anonimizaremos tus datos personales, salvo los que debamos conservar por una obligación legal.')}</p>,
  },
  {
    title: tr('7. Tus derechos'),
    body: (
      <>
        <p>{tr('Puedes en cualquier momento acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso, así como revocar tu consentimiento (derechos ARCO). Puedes editar tu nombre y tu equipo favorito desde tu perfil. Para ejercer cualquier otro derecho, o para solicitar que se elimine tu cuenta, contáctanos por los medios de la sección 10.')}</p>
        <p>{tr('Puedes desactivar las notificaciones en cualquier momento desde la configuración de tu navegador o dispositivo.')}</p>
      </>
    ),
  },
  {
    title: tr('8. Seguridad'),
    body: <p>{tr('Aplicamos medidas técnicas razonables para proteger tu información, como conexiones cifradas y control de acceso a la base de datos. Aun así, ningún sistema es completamente infalible; te recomendamos usar una contraseña única y no compartirla.')}</p>,
  },
  {
    title: tr('9. Menores de edad'),
    body: <p>{tr('La app está pensada para personas mayores de edad. Si eres menor de edad, necesitas el consentimiento de tu madre, padre o tutor para usarla.')}</p>,
  },
  {
    title: tr('10. Contacto'),
    body: (
      <p>
        {tr('Para dudas, solicitudes de acceso, corrección o eliminación de datos, escríbenos por')}{' '}
        <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        {CONTACT_EMAIL && <> {tr('o al correo')} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></>}.
      </p>
    ),
  },
  {
    title: tr('11. Cambios a este aviso'),
    body: <p>{tr('Podemos actualizar este aviso cuando cambie la app o la ley aplicable. La fecha de la última actualización aparece al inicio. Si hacemos cambios importantes, lo avisaremos dentro de la app.')}</p>,
  },
  ]
}

export default function PrivacyNotice() {
  const sections = getSections()
  const updated = UPDATED.toLocaleDateString(localeTag(), { year: 'numeric', month: 'long', day: 'numeric' })
  function back() {
    // si se abrio en otra pestaña, la cierra; si no, regresa al inicio
    if (window.history.length <= 1) window.close()
    window.location.hash = ''
  }
  return (
    <div className="page-wrap narrow privacy-page">
      <button onClick={back} className="privacy-back">{tr('← Volver')}</button>
      <h1 className="privacy-h1">{tr('Aviso de privacidad')}</h1>
      <p className="privacy-updated">{tr('Última actualización: {date}', { date: updated })}</p>
      <p className="privacy-lead">
        {tr('Tu privacidad es importante. Este aviso explica de forma sencilla qué datos personales recopila Quiniela, para qué los usa y qué puedes hacer con ellos.')}
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
