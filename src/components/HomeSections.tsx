import type { ReactNode } from 'react'
import { tr } from '../i18n'
import { IconWhatsapp, IconTrophy, IconUsers, IconClipboard } from './icons'

// >>> CAMBIA AQUI el numero de WhatsApp (con codigo de pais, solo digitos).
// Ejemplo Mexico: '5215512345678'. Si queda vacio, el boton de WhatsApp se oculta.
export const WHATSAPP_NUMBER = '524613588649'
export const WHATSAPP_MESSAGE = 'Hola, quiero unirme a la siguiente jornada de la Quiniela NFL'

export function whatsappUrl() {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(tr(WHATSAPP_MESSAGE))}`
}

export interface HeroStat { value: string | number; label: string }

export function Hero({ badge, actions, stats, chips = ['NFL'], season }: {
  badge: string
  actions: ReactNode
  stats: HeroStat[]
  chips?: string[]
  // datos reales del usuario (posicion y puntos globales); si no hay, se muestra el logo
  season?: { rank: number | string; points: number | string } | null
}) {
  return (
    <section className="home-hero" data-spot="hero">
      <div>
        <span className="home-badge"><i /> {badge}</span>
        <h1 className="home-title">{tr('PREDICE.')}<br /><em>{tr('COMPITE.')}</em><br />{tr('GANA.')}</h1>
        <p className="home-lead">{tr('Predice los marcadores de la NFL con tus amigos, suma puntos cada jornada y compite por el primer lugar.')}</p>
        <div className="home-actions">{actions}</div>
        <div className="home-chips">{chips.map((c) => <span key={c} className="home-chip">{c}</span>)}</div>
      </div>
      <div className={`home-statcard${season ? ' has-season' : ''}`}>
        {season ? (
          <>
            <p className="eyebrow">{tr('TU TEMPORADA')}</p>
            <div className="home-season">
              <div><b>#{season.rank}</b><span>{tr('Posición')}</span></div>
              <div><b className="w">{season.points}</b><span>{tr('Puntos')}</span></div>
            </div>
          </>
        ) : (
          <div className="logo-row">
            <img src="/logo.png" alt="Quiniela" className="logo-dark" />
            <img src="/logo-light.png" alt="Quiniela" className="logo-light" />
          </div>
        )}
        <div className="home-stats">
          {stats.map((s) => (
            <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow && <p className="home-eyebrow">{eyebrow}</p>}
      <h2 className="home-h2">{title}</h2>
    </div>
  )
}

const STEPS = [
  { n: '01', icon: <IconUsers size={22} />, title: 'Únete a una liga', text: 'Entra con el link de invitación que te comparta el administrador.' },
  { n: '02', icon: <IconClipboard size={22} />, title: 'Haz tus predicciones', text: 'Elige el marcador de cada partido antes de que arranque el juego.' },
  { n: '03', icon: <IconTrophy size={22} />, title: 'Suma puntos y gana', text: 'Acierta ganadores y marcadores exactos y sube en la tabla.' },
]

export function HowToPlay() {
  return (
    <section id="como-jugar" data-spot="como-jugar" style={{ scrollMarginTop: 120 }}>
      <SectionTitle eyebrow={tr('PASO A PASO')} title={tr('Cómo jugar')} />
      <div className="how-grid">
        {STEPS.map((s) => (
          <div key={s.n} className="how-step">
            <div className="how-top">
              <span className="how-num">{s.n}</span>
              <span className="home-ico">{s.icon}</span>
            </div>
            <h3>{tr(s.title)}</h3>
            <p>{tr(s.text)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function WhatsAppCta() {
  return (
    <section id="whatsapp" data-spot="whatsapp" className="home-cta" style={{ scrollMarginTop: 120 }}>
      <IconTrophy size={30} className="mx-auto" />
      <h2>{tr('¿Listo para la')}<br />{tr('siguiente jornada?')}</h2>
      <p>{tr('Escríbenos y te agregamos a la próxima quiniela.')}</p>
      {WHATSAPP_NUMBER && (
        <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="home-btn white">
          <IconWhatsapp size={16} /> {tr('Escribir por WhatsApp')}
        </a>
      )}
    </section>
  )
}

export function SiteFooter() {
  return <footer className="home-footer" data-spot="footer">© {new Date().getFullYear()} Quiniela · {tr('Predice. Compite. Gana.')} · <a href="#privacidad" className="home-footer-link">{tr('Aviso de privacidad')}</a></footer>
}

let clearSpot: (() => void) | null = null

// Resalta una seccion: baja hasta ella y opaca todo lo demas. En cuanto el
// usuario mueve el scroll (rueda, dedo, teclado o barra), todo vuelve a la normalidad.
export function spotlight(id: string) {
  clearSpot?.()
  const target = document.getElementById(id)
  if (!target) return
  const spotId = target.dataset.spot ?? id
  document.querySelectorAll<HTMLElement>('[data-spot]').forEach((el) => el.classList.toggle('spot-dim', el.dataset.spot !== spotId))
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const events = ['wheel', 'touchmove', 'keydown', 'mousedown'] as const
  const reset = () => {
    document.querySelectorAll('.spot-dim').forEach((el) => el.classList.remove('spot-dim'))
    events.forEach((e) => window.removeEventListener(e, reset))
    window.removeEventListener('scroll', onScroll)
    clearTimeout(timer)
    clearSpot = null
  }
  // el propio desplazamiento suave dispara 'scroll'; solo lo escuchamos cuando termina
  const onScroll = () => reset()
  const timer = window.setTimeout(() => window.addEventListener('scroll', onScroll, { passive: true }), 1100)
  events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
  clearSpot = reset
}

// Barra de navegacion del inicio: "Jornadas" y "Como jugar" bajan a esa
// seccion; "WhatsApp" abre el chat directo con el numero configurado arriba.
export function HomeNav({ jornadasId = 'jornadas', top = 0, brand = false, right }: { jornadasId?: string; top?: number; brand?: boolean; right?: ReactNode }) {
  return (
    <nav className="home-nav" style={{ top }}>
      <div className="home-nav-inner">
        {brand ? (
          <div className="home-nav-brand">
            <img src="/logo.png" alt="Quiniela" className="logo-dark" />
            <img src="/logo-light.png" alt="Quiniela" className="logo-light" />
          </div>
        ) : <span />}
        <div className="home-nav-links">
          <button onClick={() => spotlight(jornadasId)}>{tr('Jornadas')}</button>
          <button onClick={() => spotlight('como-jugar')}>{tr('Cómo jugar')}</button>
          {WHATSAPP_NUMBER && (
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          )}
          {right}
        </div>
      </div>
    </nav>
  )
}
