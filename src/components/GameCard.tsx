import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Pick } from '../lib/types'
import { TEAM_NAMES, TEAM_CITIES } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'
import { IconCalendar, IconClock, IconLock, IconCheck, IconBookmark, IconHourglass, IconTrash, IconUsers, IconTrophy } from './icons'
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
export default function GameCard({
  game,
  userId,
  members,
  pickedUserIds,
  forceLocked,
  forceLockedReason,
  pointsWinner,
  pointsExact,
}: {
  game: Game
  userId: string
  members: MemberInfo[]
  pickedUserIds: string[]
  forceLocked?: boolean
  forceLockedReason?: string
  pointsWinner?: number
  pointsExact?: number
}) {
  const [pick, setPick] = useState<Pick | null>(null)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPickers, setShowPickers] = useState(false)
  const [othersPicks, setOthersPicks] = useState<Record<string, { pred_home_score: number; pred_away_score: number; points: number | null }>>({})

  const kickoffTime = new Date(game.kickoff).getTime()
  const lockTime = kickoffTime - LOCK_MINUTES * 60 * 1000
  const naturallyLocked = lockTime <= Date.now()
  const locked = naturallyLocked || !!forceLocked
  // la base de datos deja ver los pronosticos de los demas justo al kickoff
  // (no desde que se cierra la prediccion, que es un poco antes) -- usamos
  // este momento para saber cuando ya se pueden mostrar
  const othersVisible = kickoffTime <= Date.now()
  const closingSoon = !locked && lockTime - WARNING_MINUTES * 60 * 1000 <= Date.now()
  const confirmed = pick != null && home !== '' && away !== '' && String(pick.pred_home_score) === home && String(pick.pred_away_score) === away
  const tickingClock = useTickingClock(game.game_clock, game.status === 'live')

  // quien va ganando segun lo que se lleva escrito (para resaltar visualmente)
  const awayLeading = away !== '' && home !== '' && Number(away) > Number(home)
  const homeLeading = away !== '' && home !== '' && Number(home) > Number(away)

  useEffect(() => {
    supabase
      .from('picks')
      .select('pred_home_score, pred_away_score, points')
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

  // una vez que ya arranco el partido, RLS deja ver los pronosticos de todo
  // el grupo (antes de eso, solo regresa el propio, sin necesidad de filtrar
  // nada aqui -- la base de datos ya se encarga)
  useEffect(() => {
    if (!othersVisible) return
    supabase
      .from('picks')
      .select('user_id, pred_home_score, pred_away_score, points')
      .eq('game_id', game.id)
      .then(({ data }) => {
        const map: typeof othersPicks = {}
        ;(data ?? []).forEach((p: any) => { map[p.user_id] = p })
        setOthersPicks(map)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, othersVisible])

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

  const [deleting, setDeleting] = useState(false)
  async function deletePick() {
    if (locked || !pick || deleting) return
    if (!window.confirm('¿Eliminar tu predicción de este partido?')) return
    setDeleting(true)
    const { error, data } = await supabase.from('picks').delete().eq('game_id', game.id).eq('user_id', userId).select()
    setDeleting(false)
    if (!error && data && data.length > 0) {
      setPick(null)
      setHome('')
      setAway('')
    } else {
      alert('No se pudo eliminar la predicción. Puede que el partido ya haya cerrado.')
    }
  }

  // toca el nombre/logo de un equipo para elegirlo como ganador directo,
  // sin tener que escribir el marcador exacto (lo puedes afinar despues)
  function selectWinner(side: 'away' | 'home') {
    if (locked) return
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

  const isFinal = game.status === 'final'
  const won = isFinal && pick != null && (pick.points ?? 0) > 0
  const missed = isFinal && (pick == null || (pick.points ?? 0) === 0)
  const pendingConfirmed = !isFinal && confirmed

  const cardBorder = won
    ? 'var(--color-turf-green)'
    : missed
    ? 'var(--color-scoreboard-red)'
    : pendingConfirmed
    ? 'var(--color-light-amber)'
    : 'var(--color-field-line)'

  const cardBg = won
    ? 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.12)), rgba(61,139,95,0.08)'
    : missed
    ? 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.12)), rgba(228,70,43,0.07)'
    : pendingConfirmed
    ? 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.12)), rgba(242,183,5,0.06)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.15)), var(--color-field-surface)'

  const cardShadowColor = won
    ? 'rgba(61,139,95,0.25)'
    : missed
    ? 'rgba(228,70,43,0.22)'
    : pendingConfirmed
    ? 'rgba(242,183,5,0.22)'
    : 'rgba(0,0,0,0.45)'

  // el color dorado (prediccion guardada) solo se le pone a la casilla del
  // equipo que va ganando en tu prediccion -- el otro lado se queda neutro
  const scoreInputBaseClass = won
    ? 'bg-[rgba(61,139,95,0.15)] border border-[var(--color-turf-green)] text-[var(--color-turf-green)]'
    : missed
    ? 'bg-[rgba(228,70,43,0.12)] border border-[var(--color-scoreboard-red)] text-[var(--color-scoreboard-red)]'
    : 'bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] focus:border-[var(--color-light-amber)]'

  const awayScoreInputClass = !won && !missed && awayLeading
    ? 'bg-[rgba(242,183,5,0.18)] border-2 border-[var(--color-light-amber)] text-[var(--color-light-amber)]'
    : scoreInputBaseClass

  const homeScoreInputClass = !won && !missed && homeLeading
    ? 'bg-[rgba(242,183,5,0.18)] border-2 border-[var(--color-light-amber)] text-[var(--color-light-amber)]'
    : scoreInputBaseClass

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 transition-all duration-150 hover:-translate-y-0.5 ${!locked && !confirmed ? 'scoreboard-glow' : ''}`}
      style={{
        borderColor: cardBorder,
        background: `radial-gradient(480px 220px at 8% 15%, rgba(228,70,43,0.16), transparent 65%), radial-gradient(480px 220px at 92% 15%, rgba(61,139,95,0.18), transparent 65%), ${cardBg}`,
        boxShadow: `0 6px 16px -4px ${cardShadowColor}, 0 2px 6px rgba(0,0,0,0.3)`,
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm text-[var(--color-text-muted)] flex items-center gap-1.5">
          <IconCalendar size={14} />
          {kickoffLabel}
        </span>
        {game.status === 'final' ? (
          <StatusPill label="FINALIZADO" variant={won ? 'green' : 'red'} icon={<IconCheck size={10} />} />
        ) : game.status === 'live' ? (
          <StatusPill label={`EN VIVO${tickingClock ? ` · ${tickingClock}` : ''}`} variant="red" pulse />
        ) : forceLocked && !naturallyLocked ? (
          <StatusPill label="CONFIRMA PARA JUGAR" variant="amber" icon={<IconLock size={10} />} />
        ) : locked ? (
          <StatusPill label="CERRADO" variant="muted" icon={<IconLock size={10} />} />
        ) : closingSoon ? (
          <StatusPill label="CIERRA PRONTO" variant={pendingConfirmed ? 'amber' : 'red'} icon={<IconClock size={10} />} />
        ) : (
          <StatusPill label="ABIERTO" variant={pendingConfirmed ? 'amber' : 'muted'} />
        )}
      </div>

      {naturallyLocked && !pick ? (
        <div className="text-center py-3 text-sm text-[var(--color-text-muted)] italic">
          No participaste en este partido
        </div>
      ) : forceLocked ? (
        <div className="text-center py-3 text-sm text-[var(--color-light-amber)] italic">
          {forceLockedReason ?? 'Confirma tu participacion para poder predecir'}
        </div>
      ) : (
        <div>
          <div className="grid items-center gap-x-1 gap-y-1.5" style={{ gridTemplateColumns: 'auto 1fr auto 1fr auto' }}>
            {/* escudo + abreviatura del visitante, encerrados juntos -- fila 2, columnas 1-2 */}
            <div
              onClick={() => selectWinner('away')}
              className={`flex items-center gap-3 rounded-3xl px-3 py-2 transition-shadow ${!locked ? 'cursor-pointer' : ''}`}
              style={{
                gridColumn: '1 / span 2',
                gridRow: '2',
                justifySelf: 'start',
                boxShadow: awayLeading ? 'inset 0 0 0 3px var(--color-light-amber)' : undefined,
                background: awayLeading ? 'rgba(242,183,5,0.08)' : undefined,
              }}
            >
              <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="w-20 h-20 object-contain shrink-0" loading="lazy" />
            </div>

            {/* ciudad del visitante -- col 2, fila 1 */}
            <span
              onClick={() => selectWinner('away')}
              className={`text-[11px] font-bold text-[var(--color-light-amber)] uppercase tracking-wider truncate text-center ${!locked ? 'cursor-pointer' : ''}`}
              style={{ gridColumn: '2', gridRow: '1' }}
            >
              {TEAM_CITIES[game.away_team] ?? ''}
            </span>

            {/* escudo NFL -- col 3, fila 1 */}
            <img
              src="https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png"
              alt="NFL"
              className="w-8 h-8 object-contain opacity-90 justify-self-center"
              style={{ gridColumn: '3', gridRow: '1' }}
              loading="lazy"
            />

            {/* ciudad del local -- col 4, fila 1 */}
            <span
              onClick={() => selectWinner('home')}
              className={`text-[11px] font-bold text-[var(--color-light-amber)] uppercase tracking-wider truncate text-center ${!locked ? 'cursor-pointer' : ''}`}
              style={{ gridColumn: '4', gridRow: '1' }}
            >
              {TEAM_CITIES[game.home_team] ?? ''}
            </span>

            {/* escudo + abreviatura del local, encerrados juntos -- fila 2, columnas 4-5 */}
            <div
              onClick={() => selectWinner('home')}
              className={`flex items-center justify-end gap-3 rounded-3xl px-3 py-2 transition-shadow ${!locked ? 'cursor-pointer' : ''}`}
              style={{
                gridColumn: '4 / span 2',
                gridRow: '2',
                justifySelf: 'end',
                boxShadow: homeLeading ? 'inset 0 0 0 3px var(--color-light-amber)' : undefined,
                background: homeLeading ? 'rgba(242,183,5,0.08)' : undefined,
              }}
            >
              <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="w-20 h-20 object-contain shrink-0" loading="lazy" />
            </div>

            {/* marcador -- col 3, fila 2 */}
            <div className="flex items-center gap-1.5 justify-self-center" style={{ gridColumn: '3', gridRow: '2' }}>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={0}
                value={away}
                disabled={locked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setAway(e.target.value)}
                className={`w-16 h-16 text-center font-mono-score text-3xl font-800 rounded-3xl outline-none disabled:opacity-60 transition-colors ${awayScoreInputClass}`}
                style={awayLeading ? { boxShadow: '0 0 8px 0 rgba(242,183,5,0.5)' } : undefined}
              />
              <span className="text-[var(--color-text-muted)] text-xl">–</span>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={0}
                value={home}
                disabled={locked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setHome(e.target.value)}
                className={`w-16 h-16 text-center font-mono-score text-3xl font-800 rounded-3xl outline-none disabled:opacity-60 transition-colors ${homeScoreInputClass}`}
                style={homeLeading ? { boxShadow: '0 0 8px 0 rgba(242,183,5,0.5)' } : undefined}
              />
            </div>

            {/* apodo + pill del visitante -- col 2, fila 3 */}
            <div
              onClick={() => selectWinner('away')}
              className={`flex flex-col items-center min-w-0 ${!locked ? 'cursor-pointer' : ''}`}
              style={{ gridColumn: '2', gridRow: '3' }}
            >
              <span className="text-xs text-[var(--color-text-muted)] truncate max-w-full">{TEAM_NAMES[game.away_team] ?? ''}</span>
              <span
                className="mt-1.5 text-[9px] font-bold uppercase tracking-wide px-3 py-1 rounded-full whitespace-nowrap"
                style={{ background: 'rgba(228,70,43,0.18)', color: '#FF6B52' }}
              >
                Visitante
              </span>
            </div>

            {/* "TU PREDICCION" -- col 3, fila 3 */}
            <span
              className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-light-amber)] whitespace-nowrap justify-self-center"
              style={{ gridColumn: '3', gridRow: '3' }}
            >
              Tu prediccion
            </span>

            {/* apodo + pill del local -- col 4, fila 3 */}
            <div
              onClick={() => selectWinner('home')}
              className={`flex flex-col items-center min-w-0 ${!locked ? 'cursor-pointer' : ''}`}
              style={{ gridColumn: '4', gridRow: '3' }}
            >
              <span className="text-xs text-[var(--color-text-muted)] truncate max-w-full">{TEAM_NAMES[game.home_team] ?? ''}</span>
              <span
                className="mt-1.5 text-[9px] font-bold uppercase tracking-wide px-3 py-1 rounded-full whitespace-nowrap"
                style={{ background: 'rgba(61,139,95,0.2)', color: '#4ADE80' }}
              >
                Local
              </span>
            </div>
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

      {members.length > 0 && (
        <button
          onClick={() => setShowPickers(true)}
          className="flex items-center gap-1.5 mt-4 flex-wrap w-full text-left hover:opacity-80 transition"
        >
          <IconUsers size={13} className="text-[var(--color-text-muted)] shrink-0" />
          <span className="text-xs text-[var(--color-text-muted)] ">
            {pickedUserIds.length}/{members.length}
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
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="w-5 h-5 object-contain" loading="lazy" />
                {game.away_team} @ {game.home_team}
                <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="w-5 h-5 object-contain" loading="lazy" />
              </h3>
              <button onClick={() => setShowPickers(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-lg leading-none">✕</button>
            </div>
            {locked && !othersVisible && (
              <p className="text-[10px] text-[var(--color-text-muted)] mb-2">
                Los pronosticos de los demas se muestran en cuanto arranca el partido.
              </p>
            )}
            <div className="space-y-1.5">
              {members.map((m) => {
                const done = pickedUserIds.includes(m.user_id)
                const theirs = othersPicks[m.user_id]
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
                    {othersVisible && theirs ? (
                      <span className="text-xs font-mono-score font-semibold flex items-center gap-1.5">
                        {theirs.pred_away_score}-{theirs.pred_home_score}
                        {theirs.points != null && theirs.points > 0 && (
                          <span className="text-[var(--color-light-amber)]">+{theirs.points}</span>
                        )}
                      </span>
                    ) : othersVisible && !done ? (
                      <span className="text-[10px] text-[var(--color-text-muted)] italic">No participo</span>
                    ) : done ? (
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

      {!locked && (
        <div className="flex gap-2 mt-5">
          <button
            onClick={save}
            disabled={saving || home === '' || away === '' || confirmed}
            className={`flex-1 text-sm font-bold rounded-xl py-2.5 transition disabled:opacity-70 flex items-center justify-center gap-2 ${
              confirmed ? 'bg-[rgba(61,139,95,0.15)] border border-[var(--color-turf-green)] text-[var(--color-turf-green)]' : 'bg-[var(--color-light-amber)] text-[var(--color-field-night)] hover:brightness-110'
            }`}
          >
            {saved || confirmed ? (
              <><IconCheck size={16} /> Predicción guardada</>
            ) : (
              <><IconBookmark size={16} /> {saving ? 'Guardando...' : 'Guardar predicción'}</>
            )}
          </button>
          {pick && (
            <button
              onClick={deletePick}
              disabled={deleting}
              title="Eliminar predicción"
              aria-label="Eliminar predicción"
              className="flex-1 text-sm font-bold rounded-xl py-2.5 transition disabled:opacity-70 flex items-center justify-center gap-2 bg-[rgba(228,70,43,0.12)] border border-[var(--color-scoreboard-red)] text-[var(--color-scoreboard-red)] hover:bg-[rgba(228,70,43,0.2)]"
            >
              <IconTrash size={16} /> {deleting ? 'Eliminando...' : 'Eliminar predicción'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
