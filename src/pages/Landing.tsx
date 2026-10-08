import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { HomeNav, Hero, HowToPlay, WhatsAppCta, SiteFooter, SectionTitle } from '../components/HomeSections'
import { IconTrophy, IconTarget, IconUsers } from '../components/icons'

const FEATURES = [
  { icon: <IconTarget size={18} />, title: 'Marcadores exactos', text: 'Más puntos si clavas el resultado.' },
  { icon: <IconUsers size={18} />, title: 'Ligas con amigos', text: 'Invita por link y compite en tu grupo.' },
  { icon: <IconTrophy size={18} />, title: 'Tabla en vivo', text: 'Posiciones que se actualizan al instante.' },
]

interface PublicGroup { id: string; name: string; logo_url: string | null; status: 'activa' | 'proxima' | 'finalizada'; members_count: number }
const PILL: Record<PublicGroup['status'], { label: string; color: string }> = {
  activa: { label: 'Activa', color: '#3D8B5F' },
  proxima: { label: 'Próxima', color: '#F2B705' },
  finalizada: { label: 'Finalizada', color: '#8A94A3' },
}

export default function Landing({ onEnter }: { onEnter: (mode: 'signin' | 'signup') => void }) {
  const [groups, setGroups] = useState<PublicGroup[] | null>(null)
  useEffect(() => {
    supabase.rpc('public_groups').then(({ data, error }) => setGroups(error ? [] : ((data ?? []) as PublicGroup[])))
  }, [])

  return (
    <>
    <HomeNav brand />
    <div className="home-wrap home-stack">
      <Hero
        badge="EN JUEGO ESTA SEMANA"
        chips={['NFL', 'Pronósticos', 'Ligas privadas']}
        stats={[{ value: 32, label: 'Equipos' }, { value: 18, label: 'Semanas' }, { value: 272, label: 'Partidos' }]}
        actions={
          <>
            <button onClick={() => onEnter('signup')} className="home-btn amber">Jugar ahora</button>
            <button onClick={() => onEnter('signin')} className="home-btn secondary">Entrar</button>
          </>
        }
      />
      {groups && groups.length > 0 && (
        <section id="jornadas" data-spot="jornadas" style={{ scrollMarginTop: 120 }}>
          <SectionTitle eyebrow="QUINIELAS" title="Jornadas activas" />
          <div className="home-leagues">
            {groups.map((g) => (
              <div key={g.id} className="home-card" style={{ alignItems: 'center', opacity: g.status === 'finalizada' ? 0.7 : 1 }}>
                {g.logo_url
                  ? <img src={g.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flex: 'none' }} />
                  : <span className="home-ico"><IconTrophy size={20} /></span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</h3>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: PILL[g.status].color, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>● {PILL[g.status].label}</span>
                    <span>{g.members_count} jugadores</span>
                  </p>
                </div>
                <button onClick={() => onEnter('signin')} className="home-btn amber sm">
                  {g.status === 'finalizada' ? 'Ver' : 'Jugar'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <section id={groups && groups.length > 0 ? undefined : 'jornadas'} data-spot={groups && groups.length > 0 ? 'features' : 'jornadas'} style={{ scrollMarginTop: 120 }}>
        <SectionTitle eyebrow="POR QUÉ JUGAR" title="Todo en un lugar" />
        <div className="home-cards cols3">
          {FEATURES.map((f) => (
            <div key={f.title} className="home-card">
              <span className="home-ico">{f.icon}</span>
              <div><h3>{f.title}</h3><p>{f.text}</p></div>
            </div>
          ))}
        </div>
      </section>
      <HowToPlay />
      <WhatsAppCta />
      <SiteFooter />
    </div>
    </>
  )
}
