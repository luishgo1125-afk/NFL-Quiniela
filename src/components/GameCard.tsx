import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Pick } from '../lib/types'
import { TEAM_NAMES } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'
import { IconCalendar, IconClock, IconLock, IconCheck, IconBookmark, IconHourglass } from './icons'
import StatusPill from './StatusPill'

// Cuenta hacia atras en pantalla, segundo a segundo, entre cada sincronizacion
// real con ESPN, para dar sensacion de tiempo real aunque solo se consulte
// ESPN cada cierto tiempo. Se reinicia cada vez que llega un dato fresco.
function useTickingClock(rawClock: string | null, live: boolean): string | null {
  const [display, setDisplay] = useState(rawClock)

  useEffect(() => {
    setDisplay(rawClock)
    if (!live || !rawClock) return

    const match = rawClock.match(/(\d+):(\d{2})/)
    if (!match) return
    let totalSeconds = parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
    const suffix = rawClock.replace(/\d+:\d{2}/, '').trim()

    const interval = setInterval(() => {
      totalSeconds = Math.max(0, totalSeconds - 1)
      const m = Math.floor(totalSeconds / 60)
      const s = totalSeconds % 60
      setDisplay(`${m}:${String(s).padStart(2, '0')}${suffix ? ' ' + suffix : ''}`)
    }, 1000)

    return () => clearInterval(interval)
  }, [rawClock, live])

  return display
}

interface MemberInfo {
  user_id: string
  display_name: string
  favorite_team: string | null
}

const LOCK_MINUTES = 30
const WARNING_MINUTES = 150 // "cierra pronto" empieza 2.5h antes del cierre real (2h antes de kickoff)
const PENDING_DAYS = 8 // las predicciones "abren" 7 dias antes del kickoff

export default function GameCard({
  game,
  userId,
  members,
  pickedUserIds,
}: {
  game: Game
  userId: string
  members: MemberInfo[]
  pickedUserIds: string[]
}) {
  const [pick, setPick] = useState<Pick | null>(null)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPickers, setShowPickers] = useState(false)

  const kickoffTime = new Date(game.kickoff).getTime()
  const lockTime = kickoffTime - LOCK_MINUTES * 60 * 1000
  const opensAt = kickoffTime - PENDING_DAYS * 24 * 60 * 60 * 1000
  const locked = lockTime <= Date.now()
  const pending = !locked && opensAt > Date.now()
  const closingSoon = !locked && !pending && lockTime - WARNING_MINUTES * 60 * 1000 <= Date.now()
  const confirmed = pick != null && home !== '' && away !== '' && String(pick.pred_home_score) === home && String(pick.pred_away_score) === away
  const tickingClock = useTickingClock(game.game_clock, game.status === 'live')

  // quien va ganando segun lo que se lleva escrito (para resaltar visualmente)
  const awayLeading = away !== '' && home !== '' && Number(away) > Number(home)
  const homeLeading = away !== '' && home !== '' && Number(home) > Number(away)

  useEffect(() => {
    supabase
      .from('picks')
      .select('*')
      .eq('game_id', game.id)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPick(data)
          setHome(String(data.pred_home_score))
          setAway(String(data.pred_away_score))
        }
      })
  }, [game.id])

  async function save() {
    if (home === '' || away === '') return
    setSaving(true)
    const payload = {
      game_id: game.id,
      user_id: userId,
      pred_home_score: Number(home),
      pred_away_score: Number(away),
    }
    const { error, data } = await supabase.from('picks').upsert(payload, { onConflict: 'game_id,user_id' }).select().single()
    setSaving(false)
    if (!error && data) {
      setPick(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  // toca el nombre/logo de un equipo para elegirlo como ganador directo,
  // sin tener que escribir el marcador exacto (lo puedes afinar despues)
  function selectWinner(side: 'away' | 'home') {
    if (locked || pending) return
    if (away === '' || home === '') {
      if (side === 'away') { setAway('7'); setHome('0') } else { setHome('7'); setAway('0') }
      return
    }
    const alreadyLeading = side === 'away' ? awayLeading : homeLeading
    if (alreadyLeading) return
    setAway(home)
    setHome(away)
  }

  const kickoffLabel = new Date(game.kickoff).toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const opensAtLabel = new Date(opensAt).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const cardBorder = confirmed ? '#3D8B5F' : locked ? 'var(--color-field-line)' : 'var(--color-field-line)'
  const cardBg = confirmed
    ? 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.12)), rgba(61,139,95,0.08)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.15)), var(--color-field-surface)'

  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-150 hover:-translate-y-0.5 ${!locked && !confirmed && !pending ? 'scoreboard-glow' : ''}`}
      style={{
        borderColor: cardBorder,
        background: cardBg,
        boxShadow: confirmed
          ? '0 6px 16px -4px rgba(61,139,95,0.25), 0 2px 6px rgba(0,0,0,0.3)'
          : '0 6px 16px -4px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
          <IconCalendar size={12} />
          {kickoffLabel}
        </span>
        {game.status === 'final' ? (
          <StatusPill label="FINALIZADO" variant="green" icon={<IconCheck size={10} />} />
        ) : game.status === 'live' ? (
          <StatusPill label={`EN VIVO${tickingClock ? ` · ${tickingClock}` : ''}`} variant="red" pulse />
        ) : locked ? (
          <StatusPill label="CERRADO" variant="muted" icon={<IconLock size={10} />} />
        ) : pending ? (
          <StatusPill label="PENDIENTE" variant="muted" icon={<IconHourglass size={10} />} />
        ) : closingSoon ? (
          <StatusPill label="CIERRA PRONTO" variant="amber" icon={<IconClock size={10} />} />
        ) : (
          <StatusPill label="ABIERTO" variant="green" />
        )}
      </div>

      {locked && !pick ? (
        <div className="text-center py-3 text-sm text-[var(--color-text-muted)] italic">
          No participaste en este partido
        </div>
      ) : pending ? (
        <div className="text-center py-3 text-sm text-[var(--color-text-muted)] flex flex-col items-center gap-1">
          <IconHourglass size={18} />
          Las predicciones abren el {opensAtLabel}
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div
            onClick={() => selectWinner('away')}
            className={`text-right ${!locked ? 'cursor-pointer' : ''}`}
          >
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">{TEAM_NAMES[game.away_team] ?? ''}</div>
            <div
              className="inline-flex items-center justify-end gap-2 mb-1 px-2 py-1 rounded-lg transition-colors"
              style={{ background: awayLeading ? 'rgba(242,183,5,0.1)' : 'transparent', boxShadow: awayLeading ? 'inset 0 0 0 1px rgba(242,183,5,0.4)' : 'none' }}
            >
              <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="w-9 h-9 object-contain" loading="lazy" />
              <span className="font-display text-2xl font-700">{game.away_team}</span>
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">VISITANTE</div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={away}
              disabled={locked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setAway(e.target.value)}
              className={`w-14 text-center font-mono-score text-xl rounded-md py-1.5 outline-none disabled:opacity-60 transition-colors ${
                confirmed
                  ? 'bg-[rgba(61,139,95,0.15)] border border-[#3D8B5F] text-[#3D8B5F]'
                  : 'bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] focus:border-[var(--color-light-amber)]'
              }`}
            />
            <span className="text-[var(--color-text-muted)]">–</span>
            <input
              type="number"
              min={0}
              value={home}
              disabled={locked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setHome(e.target.value)}
              className={`w-14 text-center font-mono-score text-xl rounded-md py-1.5 outline-none disabled:opacity-60 transition-colors ${
                confirmed
                  ? 'bg-[rgba(61,139,95,0.15)] border border-[#3D8B5F] text-[#3D8B5F]'
                  : 'bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] focus:border-[var(--color-light-amber)]'
              }`}
            />
          </div>

          <div
            onClick={() => selectWinner('home')}
            className={`text-left ${!locked ? 'cursor-pointer' : ''}`}
          >
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">{TEAM_NAMES[game.home_team] ?? ''}</div>
            <div
              className="inline-flex items-center justify-start gap-2 mb-1 px-2 py-1 rounded-lg transition-colors"
              style={{ background: homeLeading ? 'rgba(242,183,5,0.1)' : 'transparent', boxShadow: homeLeading ? 'inset 0 0 0 1px rgba(242,183,5,0.4)' : 'none' }}
            >
              <span className="font-display text-2xl font-700">{game.home_team}</span>
              <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="w-9 h-9 object-contain" loading="lazy" />
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">LOCAL</div>
          </div>
        </div>
      )}

      {(game.status === 'final' || game.status === 'live') && (
        <div className="text-center mt-3 text-xs text-[var(--color-text-muted)]">
          {game.status === 'live' ? 'Marcador actual: ' : 'Resultado: '}
          {game.away_team} {game.away_score} – {game.home_score} {game.home_team}
          {pick?.points != null && (
            <span className="ml-2 font-semibold text-[var(--color-light-amber)]">+{pick.points} pts</span>
          )}
        </div>
      )}

      {members.length > 0 && !pending && (
        <button
          onClick={() => setShowPickers(true)}
          className="flex items-center gap-1.5 mt-4 flex-wrap w-full text-left hover:opacity-80 transition"
        >
          <span className="text-[10px] text-[var(--color-text-muted)] mr-1 underline decoration-dotted">
            {pickedUserIds.length}/{members.length} ya predijeron
          </span>
          {members.map((m) => {
            const done = pickedUserIds.includes(m.user_id)
            return (
              <div
                key={m.user_id}
                className="w-5 h-5 rounded-full flex items-center justify-center overflow-hidden text-[9px] font-display font-700 shrink-0"
                style={{
                  background: done ? 'rgba(61,139,95,0.2)' : 'var(--color-field-surface-raised)',
                  border: `1px solid ${done ? '#3D8B5F' : 'var(--color-field-line)'}`,
                  opacity: done ? 1 : 0.4,
                }}
              >
                {m.favorite_team ? (
                  <img src={teamLogoUrl(m.favorite_team)} alt={m.favorite_team} className="w-full h-full object-contain p-0.5" loading="lazy" />
                ) : (
                  m.display_name.charAt(0).toUpperCase()
                )}
              </div>
            )
          })}
        </button>
      )}

      {showPickers && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowPickers(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{game.away_team} @ {game.home_team}</h3>
              <button onClick={() => setShowPickers(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-lg leading-none">✕</button>
            </div>
            <div className="space-y-1.5">
              {members.map((m) => {
                const done = pickedUserIds.includes(m.user_id)
                return (
                  <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--color-field-surface-raised)]">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden text-[10px] font-display font-700 shrink-0"
                      style={{
                        background: done ? 'rgba(61,139,95,0.2)' : 'var(--color-field-surface)',
                        border: `1px solid ${done ? '#3D8B5F' : 'var(--color-field-line)'}`,
                      }}
                    >
                      {m.favorite_team ? (
                        <img src={teamLogoUrl(m.favorite_team)} alt={m.favorite_team} className="w-full h-full object-contain p-0.5" loading="lazy" />
                      ) : (
                        m.display_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-sm flex-1 truncate">{m.display_name}</span>
                    {done ? (
                      <span className="text-[10px] font-semibold text-[#3D8B5F] flex items-center gap-1"><IconCheck size={11} /> Ya eligio</span>
                    ) : (
                      <span className="text-[10px] text-[var(--color-text-muted)]">Falta</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {!locked && !pending && (
        <button
          onClick={save}
          disabled={saving || home === '' || away === '' || confirmed}
          className={`mt-3 w-full text-xs font-semibold rounded-md py-2 transition disabled:opacity-70 flex items-center justify-center gap-1.5 ${
            confirmed ? 'bg-[#3D8B5F] text-white' : 'bg-[var(--color-light-amber)] text-[var(--color-field-night)] hover:brightness-110'
          }`}
        >
          {saved || confirmed ? (
            <><IconCheck size={13} /> Predicción guardada</>
          ) : (
            <><IconBookmark size={13} /> {saving ? 'Guardando...' : 'Guardar predicción'}</>
          )}
        </button>
      )}
    </div>
  )
}
