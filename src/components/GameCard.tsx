import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Pick } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'

function ScoreStepper({ value, onChange, disabled, confirmed }: { value: string; onChange: (v: string) => void; disabled: boolean; confirmed: boolean }) {
  const num = value === '' ? 0 : Number(value)
  const color = confirmed ? '#3D8B5F' : 'var(--color-light-amber)'
  const glow = confirmed ? 'rgba(61,139,95,0.55)' : 'rgba(242,183,5,0.45)'

  function step(delta: number) {
    if (disabled) return
    onChange(String(Math.max(0, num + delta)))
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled}
        aria-label="Sumar"
        className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] text-[var(--color-light-amber)] hover:border-[var(--color-light-amber)] disabled:opacity-25 active:scale-95 transition"
      >
        +
      </button>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-14 h-14 text-center font-mono-score text-3xl font-700 rounded-md outline-none disabled:opacity-50 transition-colors"
        style={{ background: '#050708', color, border: `1px solid ${confirmed ? '#3D8B5F' : 'var(--color-field-line)'}`, textShadow: `0 0 8px ${glow}` }}
      />
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || num <= 0}
        aria-label="Restar"
        className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] disabled:opacity-25 active:scale-95 transition"
      >
        −
      </button>
    </div>
  )
}

export default function GameCard({ game, userId }: { game: Game; userId: string }) {
  const [pick, setPick] = useState<Pick | null>(null)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const locked = new Date(game.kickoff).getTime() - 60 * 60 * 1000 <= Date.now()
  const confirmed = pick != null && home !== '' && away !== '' && String(pick.pred_home_score) === home && String(pick.pred_away_score) === away

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
    const { error } = await supabase.from('picks').upsert(payload, { onConflict: 'game_id,user_id' })
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const kickoffLabel = new Date(game.kickoff).toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={`rounded-lg border p-4 ${locked ? 'border-[var(--color-field-line)] bg-[var(--color-field-surface)]' : 'border-[var(--color-field-line)] bg-[var(--color-field-surface)] scoreboard-glow'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--color-text-muted)] font-mono-score">{kickoffLabel}</span>
        {game.status === 'final' ? (
          <span className="text-xs font-semibold text-[var(--color-turf-green)]">FINAL</span>
        ) : game.status === 'live' ? (
          <span className="text-xs font-semibold text-[var(--color-scoreboard-red)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-scoreboard-red)] animate-pulse" />
            EN VIVO{game.game_clock ? ` · ${game.game_clock}` : ''}
          </span>
        ) : locked ? (
          <span className="text-xs font-semibold text-[var(--color-scoreboard-red)]">CERRADO</span>
        ) : (
          <span className="text-xs font-semibold text-[var(--color-light-amber)]">ABIERTO</span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="font-display text-2xl font-700">{game.away_team}</span>
            <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="w-8 h-8 object-contain" loading="lazy" />
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">VISITANTE</div>
        </div>

        <div className="flex items-end gap-3">
          <ScoreStepper value={away} onChange={setAway} disabled={locked} confirmed={confirmed} />
          <span className="text-[var(--color-text-muted)] text-xl mb-4">–</span>
          <ScoreStepper value={home} onChange={setHome} disabled={locked} confirmed={confirmed} />
        </div>

        <div className="text-left">
          <div className="flex items-center justify-start gap-2 mb-1">
            <span className="font-display text-2xl font-700">{game.home_team}</span>
            <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="w-8 h-8 object-contain" loading="lazy" />
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">LOCAL</div>
        </div>
      </div>

      {(game.status === 'final' || game.status === 'live') && (
        <div className="text-center mt-2 text-xs text-[var(--color-text-muted)]">
          {game.status === 'live' ? 'Marcador actual: ' : 'Resultado: '}
          {game.away_team} {game.away_score} – {game.home_score} {game.home_team}
          {pick?.points != null && (
            <span className="ml-2 font-semibold text-[var(--color-light-amber)]">+{pick.points} pts</span>
          )}
        </div>
      )}

      {!locked && (
        <button
          onClick={save}
          disabled={saving || home === '' || away === '' || (confirmed && !saving)}
          className={`mt-3 w-full text-xs font-semibold rounded-md py-1.5 transition disabled:opacity-70 ${confirmed ? 'bg-[#3D8B5F] text-white' : 'bg-[var(--color-light-amber)] text-[var(--color-field-night)] hover:brightness-110'}`}
        >
          {saved || confirmed ? 'Guardado ✓' : saving ? 'Guardando...' : 'Guardar prediccion'}
        </button>
      )}
    </div>
  )
}
