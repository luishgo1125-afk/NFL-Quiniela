import { useEffect, useState } from 'react'
import { fetchNflStandings, type StandingsConference } from '../lib/espn'
import { teamLogoUrl } from '../lib/teamLogos'
import { IconShield } from '../components/icons'

export default function NflStandings() {
  const [conferences, setConferences] = useState<StandingsConference[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchNflStandings()
        if (!cancelled) setConferences(data)
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'No se pudieron cargar las posiciones.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl font-800 flex items-center gap-3 mb-1">
        <IconShield size={32} className="text-[var(--color-light-amber)]" /> POSICIONES NFL
      </h1>
      <p className="text-[var(--color-text-muted)] text-sm mb-6">Tabla real de la liga por conferencia y division, directo de la NFL</p>

      {loading && (
        <p className="text-center text-xs text-[var(--color-text-muted)] py-10 font-mono-score animate-pulse">CARGANDO...</p>
      )}

      {err && !loading && (
        <p className="text-center text-xs text-[var(--color-scoreboard-red)] py-10">{err}</p>
      )}

      {!loading && !err && conferences && (
        <div className="space-y-8">
          {conferences.map((conf) => (
            <div key={conf.name}>
              <h2 className="font-display text-xl font-800 text-[var(--color-light-amber)] mb-3">{conf.name}</h2>
              <div className="space-y-5">
                {conf.divisions.map((div) => (
                  <div key={div.name}>
                    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">{div.name}</h3>
                    <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg overflow-hidden">
                      <div
                        className="grid gap-1 px-2.5 py-1.5 text-[9px] font-semibold text-[var(--color-text-muted)] uppercase border-b border-[var(--color-field-line)]"
                        style={{ gridTemplateColumns: '1fr repeat(5, 32px)' }}
                      >
                        <span>Equipo</span>
                        <span className="text-center">W</span>
                        <span className="text-center">L</span>
                        <span className="text-center">T</span>
                        <span className="text-center">PCT</span>
                        <span className="text-center">DIFF</span>
                      </div>
                      {div.teams.map((t, i) => (
                        <div
                          key={t.abbreviation}
                          className={`grid gap-1 items-center px-2.5 py-2 text-xs ${i !== div.teams.length - 1 ? 'border-b border-[var(--color-field-line)]' : ''}`}
                          style={{ gridTemplateColumns: '1fr repeat(5, 32px)' }}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <img src={teamLogoUrl(t.abbreviation)} alt={t.abbreviation} className="w-5 h-5 object-contain shrink-0" loading="lazy" />
                            <span className="truncate font-medium">{t.displayName}</span>
                          </span>
                          <span className="text-center font-mono-score">{t.wins}</span>
                          <span className="text-center font-mono-score">{t.losses}</span>
                          <span className="text-center font-mono-score">{t.ties}</span>
                          <span className="text-center font-mono-score text-[var(--color-text-muted)]">{t.winPercent.toFixed(3).replace(/^0/, '')}</span>
                          <span
                            className="text-center font-mono-score"
                            style={{ color: t.differential > 0 ? 'var(--color-turf-green)' : t.differential < 0 ? 'var(--color-scoreboard-red)' : 'var(--color-text-muted)' }}
                          >
                            {t.differential > 0 ? `+${t.differential}` : t.differential}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
