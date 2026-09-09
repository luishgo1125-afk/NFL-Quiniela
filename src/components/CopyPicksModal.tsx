import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { weekLabel, type Group } from '../lib/types'
import { IconCopy, IconCheck } from './icons'

const LOCK_MINUTES = 30 // mismo margen que GameCard.tsx: se cierra 30 min antes del kickoff

interface OtherGroup {
  id: string
  name: string
  logo_url: string | null
}

interface Result {
  copied: number
  locked: number
  noMatch: number
  noPick: number
}

export default function CopyPicksModal({
  currentGroup,
  weekKey,
  userId,
  onClose,
  onDone,
}: {
  currentGroup: Group
  weekKey: string
  userId: string
  onClose: () => void
  onDone: () => void
}) {
  const [otherGroups, setOtherGroups] = useState<OtherGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [sourceGroupId, setSourceGroupId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [year, seasonType, week] = weekKey.split(':').map(Number)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('group_members')
        .select('groups(id, name, logo_url)')
        .eq('user_id', userId)
        .neq('group_id', currentGroup.id)
      const list: OtherGroup[] = (data ?? []).map((row: any) => row.groups).filter(Boolean)
      setOtherGroups(list)
      setLoadingGroups(false)
    }
    load()
  }, [currentGroup.id, userId])

  async function copyFrom(sourceId: string) {
    setSourceGroupId(sourceId)
    setCopying(true)
    setError(null)

    // partidos de la liga origen en esta misma semana, con lo que yo predije ahi
    const { data: sourceGames } = await supabase
      .from('games')
      .select('id, home_team, away_team')
      .eq('group_id', sourceId)
      .eq('year', year)
      .eq('season_type', seasonType)
      .eq('week', week)
      .is('deleted_at', null)

    const sourceGameIds = (sourceGames ?? []).map((g) => g.id)
    const { data: sourcePicks } = await supabase
      .from('picks')
      .select('game_id, pred_home_score, pred_away_score')
      .eq('user_id', userId)
      .in('game_id', sourceGameIds.length > 0 ? sourceGameIds : ['00000000-0000-0000-0000-000000000000'])

    const pickByGameId: Record<string, { pred_home_score: number; pred_away_score: number }> = {}
    ;(sourcePicks ?? []).forEach((p: any) => { pickByGameId[p.game_id] = p })

    // partidos de la liga destino (esta) en la misma semana, para emparejar por equipo
    const { data: destGames } = await supabase
      .from('games')
      .select('id, home_team, away_team, kickoff')
      .eq('group_id', currentGroup.id)
      .eq('year', year)
      .eq('season_type', seasonType)
      .eq('week', week)
      .is('deleted_at', null)

    let copied = 0, locked = 0, noMatch = 0, noPick = 0

    for (const dest of destGames ?? []) {
      const src = (sourceGames ?? []).find((g) => g.home_team === dest.home_team && g.away_team === dest.away_team)
      if (!src) { noMatch++; continue }
      const theirPick = pickByGameId[src.id]
      if (!theirPick) { noPick++; continue }
      const lockTime = new Date(dest.kickoff).getTime() - LOCK_MINUTES * 60 * 1000
      if (lockTime <= Date.now()) { locked++; continue }

      const { error: upErr } = await supabase.from('picks').upsert(
        { game_id: dest.id, user_id: userId, pred_home_score: theirPick.pred_home_score, pred_away_score: theirPick.pred_away_score },
        { onConflict: 'game_id,user_id' }
      )
      if (!upErr) copied++
    }

    setResult({ copied, locked, noMatch, noPick })
    setCopying(false)
    if (copied > 0) onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><IconCopy size={14} /> Copiar predicciones</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-lg leading-none">✕</button>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mb-3">
          De {weekLabel(seasonType, week)} en otra de tus ligas hacia {currentGroup.name}, emparejando por equipos. Solo copia a partidos que aun no cierran.
        </p>

        {result ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-[var(--color-turf-green)]">
              <IconCheck size={16} /> {result.copied} predicci{result.copied === 1 ? 'on copiada' : 'ones copiadas'}
            </div>
            <ul className="text-[10px] text-[var(--color-text-muted)] space-y-0.5 pl-1">
              {result.locked > 0 && <li>{result.locked} ya estaban cerrados en esta liga</li>}
              {result.noMatch > 0 && <li>{result.noMatch} no existen en esta liga</li>}
              {result.noPick > 0 && <li>{result.noPick} no tenias prediccion en la liga origen</li>}
            </ul>
            <button
              onClick={onClose}
              className="w-full mt-2 bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110"
            >
              Listo
            </button>
          </div>
        ) : loadingGroups ? (
          <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">Cargando tus ligas...</p>
        ) : otherGroups.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">No perteneces a ninguna otra liga todavia.</p>
        ) : (
          <div className="space-y-2">
            {otherGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => copyFrom(g.id)}
                disabled={copying}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md border border-[var(--color-field-line)] hover:border-[var(--color-light-amber)] transition disabled:opacity-50 text-left"
              >
                {g.logo_url ? (
                  <img src={g.logo_url} alt={g.name} className="w-8 h-8 rounded-full object-cover border border-[var(--color-field-line)] shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center text-sm shrink-0">🏈</div>
                )}
                <span className="text-sm font-medium flex-1 truncate">{g.name}</span>
                {copying && sourceGroupId === g.id && (
                  <span className="text-[10px] text-[var(--color-light-amber)]">Copiando...</span>
                )}
              </button>
            ))}
            {error && <p className="text-[var(--color-scoreboard-red)] text-xs">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
