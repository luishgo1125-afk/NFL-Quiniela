import { spotlight, HomeNav, Hero, HowToPlay, WhatsAppCta, SiteFooter, SectionTitle } from '../components/HomeSections'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyGlobalRank } from '../lib/globalRank'
import type { Group } from '../lib/types'
import { weekLabel } from '../lib/types'
import { getGroupStandings } from '../lib/ranking'
import {
  IconClipboard, IconCalendar, IconUsers,
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

export default function QuinielasList({ user, onSelect, initialFilter = 'activa', onOpenRanking, navRight }: { navRight?: import("react").ReactNode; user: User; onSelect: (g: Group) => void; initialFilter?: 'todas' | Status; onOpenRanking?: () => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [stats, setStats] = useState<Record<string, GroupStats>>({})
  const [membersByGroup, setMembersByGroup] = useState<Record<string, Member[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todas' | Status>(initialFilter)
  const [sort, setSort] = useState<'reciente' | 'nombre'>('reciente')
  const [publicGroups, setPublicGroups] = useState<{ id: string; name: string; logo_url: string | null; status: Status; members_count: number }[]>([])
  // posicion y puntos globales del usuario (misma funcion que usa la pantalla Ranking)
  const [season, setSeason] = useState<{ rank: number; points: number } | null>(null)
  useEffect(() => {
    fetchMyGlobalRank(user.id).then((res) => {
      if (res) setSeason({ rank: res.index + 1, points: res.list[res.index].total_points })
    })
  }, [user.id])

  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [joinErr, setJoinErr] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('public_groups').then(({ data, error }) => { if (!error) setPublicGroups((data ?? []) as any) })
  }, [user.id])

  async function joinPublic(id: string) {
    setJoiningId(id)
    setJoinErr(null)
    const { error } = await supabase.rpc('join_public_group', { p_group_id: id })
    if (error) { setJoiningId(null); setJoinErr(error.message); return }
    const { data } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
    setJoiningId(null)
    if (data) onSelect(data as Group)
  }

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
    <>
    <HomeNav top={0} brand right={navRight} />
    <div className="home-wrap">
      <Hero
        badge="EN JUEGO ESTA SEMANA"
        chips={['NFL', 'Pronósticos']}
        season={season}
        stats={[
          { value: counts.activa, label: 'Activas' },
          { value: groups.length, label: 'Mis ligas' },
          { value: Object.values(stats).reduce((a, s) => a + (s.liveCount ?? 0), 0), label: 'En vivo' },
        ]}
        actions={
          <>
            <button onClick={() => { setFilter('activa'); spotlight('jornadas') }} className="home-btn amber">Jugar ahora</button>
            <button onClick={() => (onOpenRanking ? onOpenRanking() : (setFilter('todas'), spotlight('jornadas')))} className="home-btn secondary">Ver ranking</button>
          </>
        }
      />
      <div id="jornadas" data-spot="jornadas" style={{ marginTop: 40, scrollMarginTop: 120 }}>
        <SectionTitle eyebrow="TUS LIGAS" title="JORNADAS ACTIVAS" />

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
        <div className="home-leagues">
          {visibleGroups.map((g) => {
            const s = stats[g.id]
            const members = membersByGroup[g.id] ?? []
            const closesLabel = s?.closesAt
              ? new Date(s.closesAt).toLocaleString('es-MX', { weekday: 'long', hour: 'numeric', minute: '2-digit' })
              : null
            const statusMeta = STATUS_META[s?.status ?? 'proxima']
            const isLive = (s?.liveCount ?? 0) > 0
            const pct = s && s.picksTotal > 0 ? Math.round((s.picksDone / s.picksTotal) * 100) : 0
            const playersText = members.length > 0 ? members.length : (s?.membersCount ?? 0)
            return (
              <article key={g.id} className={`lcard${isLive ? ' live' : ''}`}>
                <div className="lcard-banner">
                  {g.logo_url && <img src={g.logo_url} alt="" />}
                  <span className="lcard-status" style={{ background: statusMeta.bg, color: statusMeta.text, border: `1px solid ${statusMeta.border}` }}>
                    <i style={{ background: statusMeta.dot }} /> {statusMeta.label}
                  </span>
                  {isLive && <span className="lcard-live"><i /> EN VIVO</span>}
                </div>

                <div className="lcard-head">
                  {g.logo_url
                    ? <img src={g.logo_url} alt={g.name} className="lcard-avatar" />
                    : <div className="lcard-avatar">🏈</div>}
                  <div className="lcard-title">
                    <h3>{g.name}</h3>
                    <p>
                      <IconUsers size={13} /> {playersText} jugador{playersText !== 1 ? 'es' : ''}
                      {s?.weekLabelText && <span className="lcard-week">{s.weekLabelText}</span>}
                    </p>
                  </div>
                </div>

                <div className="lcard-stats">
                  <div className="lcard-stat">
                    <span className="lcard-k"><IconClipboard size={12} /> Picks</span>
                    <b>{s && s.picksTotal > 0 ? `${s.picksDone}/${s.picksTotal}` : '—'}</b>
                    <div className="lcard-bar"><div style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="lcard-stat">
                    <span className="lcard-k"><IconCalendar size={12} /> Cierra</span>
                    <b style={{ fontSize: 15, textTransform: 'capitalize' }}>{closesLabel ?? '—'}</b>
                  </div>
                  <div className="lcard-stat">
                    <span className="lcard-k"><IconTrophy size={12} /> Posición</span>
                    <b style={{ color: s?.myRank ? 'var(--color-light-amber)' : undefined }}>{s?.myRank ? `#${s.myRank}` : '—'}</b>
                  </div>
                </div>

                <button onClick={() => onSelect(g)} className={`lcard-btn${s?.status === 'activa' ? ' primary' : ''}`}>
                  {s?.status === 'finalizada' ? 'Ver quiniela' : 'Jugar ahora'} <IconChevronRight size={16} />
                </button>
              </article>
            )
          })}
        </div>
      )}
      </div>
      {(() => {
        const joined = new Set(groups.map((g) => g.id))
        const available = publicGroups.filter((g) => !joined.has(g.id) && g.status !== 'finalizada')
        if (available.length === 0) return null
        return (
          <div id="publicas" data-spot="publicas" style={{ marginTop: 48, scrollMarginTop: 120 }}>
            <SectionTitle eyebrow="ABIERTAS PARA TODOS" title="LIGAS PÚBLICAS" />
            {joinErr && <p className="text-[var(--color-scoreboard-red)] text-xs mb-2">{joinErr}</p>}
            <div className="home-leagues">
              {available.map((g) => (
                <div key={g.id} className="home-card" style={{ alignItems: 'center' }}>
                  {g.logo_url
                    ? <img src={g.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', flex: 'none' }} />
                    : <span className="home-ico"><IconTrophy size={20} /></span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</h3>
                    <p><span style={{ color: STATUS_META[g.status].text, fontWeight: 700, fontSize: 11 }}>● {STATUS_META[g.status].label}</span> · {g.members_count} jugadores</p>
                  </div>
                  <button onClick={() => joinPublic(g.id)} disabled={joiningId === g.id} className="home-btn secondary sm">
                    {joiningId === g.id ? '...' : 'Unirme'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
      <div className="home-stack" style={{ marginTop: 48 }}>
        <HowToPlay />
        <WhatsAppCta />
        <SiteFooter />
      </div>
    </div>
    </>
  )
}
