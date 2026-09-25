import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'
import { weekLabel } from '../lib/types'
import { getGroupStandings } from '../lib/ranking'
import {
  IconClipboard, IconCalendar, IconUsers, IconCopy, IconWhatsapp,
  IconSearch, IconFilter, IconSort, IconChevronRight, IconTrophy,
} from '../components/icons'
import type { User } from '@supabase/supabase-js'

interface Member {
  user_id: string
  display_name: string
}

type Status = 'activa' | 'proxima' | 'finalizada'

interface GroupStats {
  weekLabelText: string | null
  membersCount: number
  picksDone: number
  picksTotal: number
  closesAt: string | null
  myRank: number | null
  liveCount: number
  status: Status
}

interface GameStatsRow {
  id: string
  year: number
  season_type: number
  week: number
  kickoff: string
  status: string
}

const STATUS_META: Record<Status, { label: string; dot: string; text: string; bg: string; border: string }> = {
  activa: { label: 'ACTIVA', dot: 'var(--color-turf-green)', text: 'var(--color-turf-green)', bg: 'rgba(61,139,95,0.15)', border: 'rgba(61,139,95,0.4)' },
  proxima: { label: 'PROXIMA', dot: '#4EA1E0', text: '#4EA1E0', bg: 'rgba(78,161,224,0.15)', border: 'rgba(78,161,224,0.4)' },
  finalizada: { label: 'FINALIZADA', dot: 'var(--color-text-muted)', text: 'var(--color-text-muted)', bg: 'var(--color-field-surface-raised)', border: 'var(--color-field-line)' },
}

async function loadStats(group: Group, userId: string): Promise<GroupStats> {
  const { data: memberRows } = await supabase.from('group_members').select('user_id').eq('group_id', group.id)
  const memberIds = (memberRows ?? []).map((m: any) => m.user_id)

  const { data: games } = await supabase.from('games').select('id, year, season_type, week, kickoff, status').eq('group_id', group.id).is('deleted_at', null).order('kickoff')
  const gameList = (games ?? []) as GameStatsRow[]

  const nonFinal = gameList.filter((g) => g.status !== 'final').sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
  let weekGames: GameStatsRow[] = []
  if (nonFinal.length > 0) {
    const cur = nonFinal[0]
    weekGames = gameList.filter((g) => g.year === cur.year && g.season_type === cur.season_type && g.week === cur.week)
  } else if (gameList.length > 0) {
    const last = gameList[gameList.length - 1]
    weekGames = gameList.filter((g) => g.year === last.year && g.season_type === last.season_type && g.week === last.week)
  }

  const weekLabelText = weekGames[0] ? weekLabel(weekGames[0].season_type, weekGames[0].week) : null
  const weekGameIds = weekGames.map((g) => g.id)

  let picksDone = 0
  if (weekGameIds.length > 0) {
    const { data: statusRows } = await supabase.rpc('group_pick_status', { p_group_id: group.id })
    picksDone = (statusRows ?? []).filter((r: any) => weekGameIds.includes(r.game_id)).length
  }
  const picksTotal = memberIds.length * weekGames.length

  const upcomingLocks = weekGames
    .filter((g) => g.status !== 'final')
    .map((g) => new Date(g.kickoff).getTime() - 30 * 60 * 1000)
    .filter((t) => t > Date.now())
  const closesAt = upcomingLocks.length > 0 ? new Date(Math.min(...upcomingLocks)).toISOString() : null

  const liveCount = weekGames.filter((g) => g.status === 'live').length

  let myRank: number | null = null
  if (memberIds.length > 0) {
    // misma funcion que usa la Tabla (respeta modo semanal/temporada y el
    // desempate oficial), para que "Tu posicion" nunca se desincronice
    const standings = await getGroupStandings(group, memberIds)
    const idx = standings.findIndex((s) => s.user_id === userId)
    if (idx >= 0) myRank = idx + 1
  }

  // estado de la liga: manual (desde Ajustes) tiene prioridad, luego se
  // infiere de los partidos -- finalizada si ya se jugaron todos, proxima
  // si ninguno ha arrancado todavia, activa en cualquier otro caso
  const allFinal = gameList.length > 0 && gameList.every((g) => g.status === 'final')
  const anyStarted = gameList.some((g) => new Date(g.kickoff).getTime() <= Date.now())
  let status: Status = 'proxima'
  if (group.finalized || allFinal) status = 'finalizada'
  else if (anyStarted) status = 'activa'

  return { weekLabelText, membersCount: memberIds.length, picksDone, picksTotal, closesAt, myRank, liveCount, status }
}

export default function QuinielasList({ user, onSelect }: { user: User; onSelect: (g: Group) => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [stats, setStats] = useState<Record<string, GroupStats>>({})
  const [membersByGroup, setMembersByGroup] = useState<Record<string, Member[]>>({})
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todas' | Status>('activa')
  const [sort, setSort] = useState<'reciente' | 'nombre'>('reciente')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('group_members').select('groups(*)').eq('user_id', user.id)
      const gs: Group[] = (data ?? []).map((row: any) => row.groups).filter(Boolean)
      setGroups(gs)
      setLoading(false)

      const entries = await Promise.all(gs.map(async (g) => [g.id, await loadStats(g, user.id)] as const))
      setStats(Object.fromEntries(entries))

      const memberEntries = await Promise.all(
        gs.map(async (g) => {
          const { data: rows } = await supabase
            .from('group_members')
            .select('user_id, profiles(display_name)')
            .eq('group_id', g.id)
          const members = (rows ?? []).map((r: any) => ({ user_id: r.user_id, display_name: r.profiles?.display_name ?? 'Jugador' }))
          return [g.id, members] as const
        })
      )
      setMembersByGroup(Object.fromEntries(memberEntries))
    }
    load()
  }, [user.id])

  function inviteLink(g: Group) {
    return `${window.location.origin}${window.location.pathname}?join=${g.invite_code}`
  }

  async function copyCode(g: Group) {
    try {
      await navigator.clipboard.writeText(inviteLink(g))
      setCopiedId(g.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // algunos navegadores bloquean el clipboard, sin drama
    }
  }

  const visibleGroups = useMemo(() => {
    let list = groups
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q))
    }
    if (filter !== 'todas') {
      list = list.filter((g) => (stats[g.id]?.status ?? 'proxima') === filter)
    }
    list = [...list].sort((a, b) => {
      if (sort === 'nombre') return a.name.localeCompare(b.name)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return list
  }, [groups, search, filter, sort, stats])

  const counts = useMemo(() => {
    const c: Record<'todas' | Status, number> = { todas: groups.length, activa: 0, proxima: 0, finalizada: 0 }
    groups.forEach((g) => {
      const st = stats[g.id]?.status
      if (st) c[st]++
    })
    return c
  }, [groups, stats])

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl font-800">QUINIELAS</h1>
      <p className="text-[var(--color-text-muted)] text-sm mb-6">En las que participas ahora mismo</p>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar quiniela..."
            className="w-full bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[var(--color-light-amber)]"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'todas' | Status)}
            className="appearance-none bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg pl-9 pr-8 py-2.5 text-sm outline-none focus:border-[var(--color-light-amber)] cursor-pointer"
          >
            <option value="todas">Todas</option>
            <option value="activa">Activas</option>
            <option value="proxima">Proximas</option>
            <option value="finalizada">Finalizadas</option>
          </select>
          <IconFilter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none text-[10px]">▾</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'todas', label: 'Todas' },
            { key: 'activa', label: 'Activas' },
            { key: 'proxima', label: 'Proximas' },
            { key: 'finalizada', label: 'Finalizadas' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition ${
                filter === f.key
                  ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.12)] text-[var(--color-light-amber)]'
                  : 'border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)]'
              }`}
            >
              {f.key !== 'todas' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[f.key as Status].dot }} />}
              {f.label} {counts[f.key] > 0 && counts[f.key]}
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'reciente' | 'nombre')}
            className="appearance-none bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg pl-8 pr-7 py-1.5 text-xs outline-none focus:border-[var(--color-light-amber)] cursor-pointer text-[var(--color-text-muted)]"
          >
            <option value="reciente">Mas reciente</option>
            <option value="nombre">Nombre A-Z</option>
          </select>
          <IconSort size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none text-[9px]">▾</span>
        </div>
      </div>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : groups.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm">
          Todavia no perteneces a ninguna quiniela. Ve a "Crear quiniela" abajo para crear una o unirte con un codigo.
        </p>
      ) : visibleGroups.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm">Ninguna quiniela coincide con esa busqueda/filtro.</p>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((g) => {
            const s = stats[g.id]
            const members = membersByGroup[g.id] ?? []
            const closesLabel = s?.closesAt
              ? new Date(s.closesAt).toLocaleString('es-MX', { weekday: 'long', hour: 'numeric', minute: '2-digit' })
              : null
            const statusMeta = STATUS_META[s?.status ?? 'proxima']
            const isLive = (s?.liveCount ?? 0) > 0
            return (
              <div
                key={g.id}
                className="relative rounded-2xl overflow-hidden border transition-shadow"
                style={{
                  borderColor: isLive ? 'var(--color-scoreboard-red)' : 'var(--color-field-line)',
                  boxShadow: isLive ? '0 0 24px -10px rgba(228,70,43,0.5)' : 'none',
                }}
              >
                {g.logo_url && (
                  <>
                    <img src={g.logo_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(180deg, rgba(10,14,19,0.35) 0%, var(--color-field-surface) 78%)' }}
                    />
                  </>
                )}
                {!g.logo_url && <div className="absolute inset-0 bg-[var(--color-field-surface)]" />}

                <button onClick={() => onSelect(g)} className="relative z-10 w-full text-left block">
                  <div className="flex items-start gap-3 px-4 pt-4">
                    {g.logo_url ? (
                      <img src={g.logo_url} alt={g.name} className="w-11 h-11 rounded-full object-cover border-2 border-[var(--color-field-surface)] shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center text-lg shrink-0">🏈</div>
                    )}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{g.name}</span>
                        {s?.weekLabelText && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-[var(--color-light-amber)] text-[var(--color-light-amber)] shrink-0">
                            {s.weekLabelText}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
                        <IconUsers size={11} /> {members.length > 0 ? `${members.length} jugador${members.length !== 1 ? 'es' : ''}` : `${s?.membersCount ?? 0} miembros`}
                        {isLive && (
                          <span className="ml-2 text-[10px] font-semibold text-[var(--color-scoreboard-red)] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-scoreboard-red)] animate-pulse" /> EN VIVO
                          </span>
                        )}
                      </p>
                    </div>
                    <IconChevronRight size={18} className="text-[var(--color-text-muted)] shrink-0 mt-1" />
                  </div>

                  {s && (s.picksTotal > 0 || closesLabel || s.myRank) && (
                    <div className="mt-3 pt-3 mx-4 border-t border-[var(--color-field-line)] flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)] pb-3">
                      {s.picksTotal > 0 && (
                        <span className="flex items-center gap-1">
                          <IconClipboard size={12} /> {s.picksDone}/{s.picksTotal} picks realizados
                        </span>
                      )}
                      {closesLabel && (
                        <span className="flex items-center gap-1">
                          <IconCalendar size={12} /> Cierra: {closesLabel}
                        </span>
                      )}
                      {s.myRank && (
                        <span className="text-[var(--color-light-amber)] font-semibold flex items-center gap-1">
                          <IconTrophy size={12} /> Tu posicion: #{s.myRank}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                <div className="relative z-10 px-4 pb-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCode(g) }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] transition flex items-center gap-1 bg-[var(--color-field-surface)]"
                  >
                    <IconCopy size={11} /> {copiedId === g.id ? 'Copiado ✓' : 'Copiar link'}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Unete a mi quiniela "${g.name}" en Quiniela NFL: ${inviteLink(g)}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[#25D366] hover:text-[#25D366] transition flex items-center gap-1 bg-[var(--color-field-surface)]"
                  >
                    <IconWhatsapp size={11} /> WhatsApp
                  </a>
                  <span
                    className="ml-auto text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-full flex items-center gap-1.5 shrink-0"
                    style={{ background: statusMeta.bg, color: statusMeta.text, border: `1px solid ${statusMeta.border}` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} /> {statusMeta.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
