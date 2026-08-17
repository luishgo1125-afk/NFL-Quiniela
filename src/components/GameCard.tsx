import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Pick } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'

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

  const locked = new Date(game.kickoff).getTime() - 30 * 60 * 1000 <= Date.now()
  const confirmed = pick != null && home !== '' && away !== '' && String(pick.pred_home_score) === home && String(pick.pred_away_score) === away
  const tickingClock = useTickingClock(game.game_clock, game.status === 'live')

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

  const kickoffLabel = new Date(game.kickoff).toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const cardBorder = confirmed ? '#3D8B5F' : locked ? 'var(--color-field-line)' : 'var(--color-field-line)'
  const cardBg = confirmed ? 'rgba(61,139,95,0.08)' : 'var(--color-field-surface)'

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${!locked && !confirmed ? 'scoreboard-glow' : ''}`}
      style={{ borderColor: cardBorder, background: cardBg }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--color-text-muted)] font-mono-score">{kickoffLabel}</span>
        {game.status === 'final' ? (
          <span className="text-xs font-semibold text-[var(--color-turf-green)]">FINAL</span>
        ) : game.status === 'live' ? (
          <span className="text-xs font-semibold text-[var(--color-scoreboard-red)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-scoreboard-red)] animate-pulse" />
            EN VIVO{tickingClock ? ` · ${tickingClock}` : ''}
          </span>
        ) : locked ? (
          <span className="text-xs font-semibold text-[var(--color-scoreboard-red)]">CERRADO</span>
        ) : confirmed ? (
          <span className="text-xs font-semibold text-[#3D8B5F]">GUARDADO</span>
        ) : (
          <span className="text-xs font-semibold text-[var(--color-light-amber)]">ABIERTO</span>
        )}
      </div>

      {locked && !pick ? (
        <div className="text-center py-3 text-sm text-[var(--color-text-muted)] italic">
          No participaste en este partido
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-1">
              <span className="font-display text-2xl font-700">{game.away_team}</span>
              <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="w-8 h-8 object-contain" loading="lazy" />
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">VISITANTE</div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={away}
              disabled={locked}
              onChange={(e) => setAway(e.target.value)}
              className={`w-14 text-center font-mono-score text-xl rounded-md py-1 outline-none disabled:opacity-60 transition-colors ${
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
              onChange={(e) => setHome(e.target.value)}
              className={`w-14 text-center font-mono-score text-xl rounded-md py-1 outline-none disabled:opacity-60 transition-colors ${
                confirmed
                  ? 'bg-[rgba(61,139,95,0.15)] border border-[#3D8B5F] text-[#3D8B5F]'
                  : 'bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] focus:border-[var(--color-light-amber)]'
              }`}
            />
          </div>

          <div className="text-left">
            <div className="flex items-center justify-start gap-2 mb-1">
              <span className="font-display text-2xl font-700">{game.home_team}</span>
              <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="w-8 h-8 object-contain" loading="lazy" />
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">LOCAL</div>
          </div>
        </div>
      )}

      {(game.status === 'final' || game.status === 'live') && (
        <div className="text-center mt-2 text-xs text-[var(--color-text-muted)]">
          {game.status === 'live' ? 'Marcador actual: ' : 'Resultado: '}
          {game.away_team} {game.away_score} – {game.home_score} {game.home_team}
          {pick?.points != null && (
            <span className="ml-2 font-semibold text-[var(--color-light-amber)]">+{pick.points} pts</span>
          )}
        </div>
      )}

      {members.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="text-[10px] text-[var(--color-text-muted)] mr-1">
            {pickedUserIds.length}/{members.length} ya predijeron
          </span>
          {members.map((m) => {
            const done = pickedUserIds.includes(m.user_id)
            return (
              <div
                key={m.user_id}
                title={`${m.display_name}${done ? ' — ya prediji' : ' — falta'}`}
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
        </div>
      )}

      {!locked && (
        <button
          onClick={save}
          disabled={saving || home === '' || away === '' || confirmed}
          className={`mt-3 w-full text-xs font-semibold rounded-md py-1.5 transition disabled:opacity-70 ${
            confirmed ? 'bg-[#3D8B5F] text-white' : 'bg-[var(--color-light-amber)] text-[var(--color-field-night)] hover:brightness-110'
          }`}
        >
          {saved || confirmed ? 'Guardado ✓' : saving ? 'Guardando...' : 'Guardar prediccion'}
        </button>
      )}
    </div>
  )
}
