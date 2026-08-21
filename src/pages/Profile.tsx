import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { NFL_TEAMS } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'
import {
  IconUser, IconBell, IconLock, IconEye, IconEyeOff, IconMedal,
  IconPencil, IconMail, IconShield, IconLogout, IconChevronRight, IconStar, IconTarget, IconFlame, IconUsers,
} from '../components/icons'
import { pushSupported, isPushEnabled, enablePush, disablePush } from '../lib/push'
import type { User } from '@supabase/supabase-js'

interface GlobalStats {
  rank: number | null
  points: number
  hits: number
  played: number
  streak: number
  topPoints: number
}

interface WeekBucket {
  label: string
  accuracy: number
}

function isoWeekKey(dateStr: string) {
  const d = new Date(dateStr)
  const day = (d.getUTCDay() + 6) % 7 // lunes = 0
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

function MiniLineChart({ data }: { data: WeekBucket[] }) {
  if (data.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">Todavia no hay suficientes datos.</p>
  const w = 280, h = 90, pad = 8
  const max = 100
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0
  const points = data.map((d, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - d.accuracy / max) * (h - pad * 2)
    return { x, y }
  })
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
      <defs>
        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2B705" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F2B705" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#perfGrad)" />
      <path d={linePath} fill="none" stroke="#F2B705" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#F2B705" />
      ))}
    </svg>
  )
}

function EditProfileModal({
  user, name, team, onSaved, onClose,
}: {
  user: User; name: string; team: string; onSaved: (name: string, team: string) => void; onClose: () => void
}) {
  const [n, setN] = useState(name)
  const [t, setT] = useState(team)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.from('profiles').update({ display_name: n, favorite_team: t || null }).eq('id', user.id)
    setSaving(false)
    if (error) { setMsg(error.message); return }
    onSaved(n, t)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-700">Editar perfil</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-lg leading-none">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--color-text-muted)]">Nombre</label>
            <input
              value={n}
              onChange={(e) => setN(e.target.value)}
              className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)]">Equipo favorito</label>
            <div className="flex items-center gap-2 mt-1">
              {t && <img src={teamLogoUrl(t)} alt={t} className="w-8 h-8 object-contain shrink-0" />}
              <select
                value={t}
                onChange={(e) => setT(e.target.value)}
                className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              >
                <option value="">Sin elegir</option>
                {NFL_TEAMS.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
              </select>
            </div>
          </div>
          {msg && <p className="text-xs text-[var(--color-scoreboard-red)]">{msg}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SecurityModal({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [pwOk, setPwOk] = useState(false)

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwErr(null)
    if (pw.length < 6) { setPwErr('La contrasena debe tener al menos 6 caracteres'); return }
    if (pw !== pw2) { setPwErr('Las contrasenas no coinciden'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSavingPw(false)
    if (error) { setPwErr(error.message); return }
    setPwOk(true)
    setPw('')
    setPw2('')
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-700 flex items-center gap-2"><IconShield size={18} /> Seguridad</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-lg leading-none">✕</button>
        </div>
        {pwOk ? (
          <p className="text-sm text-[var(--color-turf-green)]">Contrasena actualizada.</p>
        ) : (
          <form onSubmit={savePassword} className="space-y-3">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Nueva contrasena"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)]">
                {showPw ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPw2 ? 'text' : 'password'}
                placeholder="Confirmar contrasena"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              />
              <button type="button" onClick={() => setShowPw2((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)]">
                {showPw2 ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </button>
            </div>
            {pwErr && <p className="text-xs text-[var(--color-scoreboard-red)]">{pwErr}</p>}
            <button
              type="submit"
              disabled={savingPw}
              className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50"
            >
              {savingPw ? 'Guardando...' : 'Actualizar contrasena'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Profile({
  user,
  activeGroupName,
  showLeaveGroup,
  onLeaveGroup,
}: {
  user: User
  activeGroupName?: string | null
  showLeaveGroup?: boolean
  onLeaveGroup?: () => void
}) {
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showSecurity, setShowSecurity] = useState(false)

  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [groupCount, setGroupCount] = useState(0)
  const [chartData, setChartData] = useState<WeekBucket[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    if (pushSupported()) isPushEnabled().then(setPushEnabled)
  }, [])

  async function togglePush() {
    setPushBusy(true)
    try {
      if (pushEnabled) { await disablePush(); setPushEnabled(false) }
      else { await enablePush(user.id); setPushEnabled(true) }
    } catch {
      // se ignora aqui, el switch simplemente no cambia
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    supabase.from('profiles').select('display_name, favorite_team').eq('id', user.id).single().then(({ data }) => {
      setName(data?.display_name ?? '')
      setTeam(data?.favorite_team ?? '')
      setLoading(false)
    })
  }, [user.id])

  useEffect(() => {
    async function loadStats() {
      setLoadingStats(true)

      const { count } = await supabase.from('group_members').select('group_id', { count: 'exact', head: true }).eq('user_id', user.id)
      setGroupCount(count ?? 0)

      const { data: ranks } = await supabase.rpc('global_rankings')
      const list = ranks ?? []
      const idx = list.findIndex((r: any) => r.user_id === user.id)
      const mine = idx >= 0 ? list[idx] : null
      const topPoints = list[0]?.total_points ?? 0

      const { data: picksData } = await supabase.rpc('global_user_picks_summary', { p_user_id: user.id })
      const picks = (picksData ?? []) as { points: number; kickoff: string; points_exact: number }[]

      let streak = 0
      for (const p of picks) {
        if ((p.points ?? 0) > 0) streak++
        else break
      }

      setGlobalStats({
        rank: idx >= 0 ? idx + 1 : null,
        points: mine?.total_points ?? 0,
        hits: mine?.total_hits ?? 0,
        played: mine?.total_played ?? 0,
        streak,
        topPoints,
      })

      // agrupa por semana calendario (lunes-domingo) para la grafica de rendimiento
      const byWeek = new Map<string, { hits: number; total: number }>()
      picks.slice().reverse().forEach((p) => {
        const key = isoWeekKey(p.kickoff)
        const cur = byWeek.get(key) ?? { hits: 0, total: 0 }
        cur.total++
        if ((p.points ?? 0) > 0) cur.hits++
        byWeek.set(key, cur)
      })
      const buckets = Array.from(byWeek.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([, v], i, arr) => ({
          label: i === arr.length - 1 ? 'Actual' : `Sem ${i + 1}`,
          accuracy: v.total > 0 ? Math.round((v.hits / v.total) * 100) : 0,
        }))
      setChartData(buckets)

      setLoadingStats(false)
    }
    loadStats()
  }, [user.id])

  const winRate = globalStats && globalStats.played > 0 ? Math.round((globalStats.hits / globalStats.played) * 100) : 0
  const pointsToFirst = globalStats && globalStats.rank && globalStats.rank > 1 ? globalStats.topPoints - globalStats.points : 0
  const progressPct = globalStats && globalStats.topPoints > 0 ? Math.min(100, Math.round((globalStats.points / globalStats.topPoints) * 100)) : 0
  const prevAccuracy = chartData.length > 1 ? chartData[chartData.length - 2].accuracy : null
  const curAccuracy = chartData.length > 0 ? chartData[chartData.length - 1].accuracy : 0
  const delta = prevAccuracy != null ? curAccuracy - prevAccuracy : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {/* Encabezado + ranking */}
      <div className="grid grid-cols-[1.25fr_1fr] gap-3 w-full items-stretch">
        <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-[var(--color-field-surface-raised)] border-2 border-[var(--color-field-line)] flex items-center justify-center overflow-hidden">
                {team ? <img src={teamLogoUrl(team)} alt={team} className="w-full h-full object-contain p-2" /> : <IconUser size={26} className="text-[var(--color-text-muted)]" />}
              </div>
              <button
                onClick={() => setShowEdit(true)}
                aria-label="Editar perfil"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] flex items-center justify-center border-2 border-[var(--color-field-surface)]"
              >
                <IconPencil size={11} />
              </button>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-800 leading-none truncate">{loading ? '...' : (name || user.email?.split('@')[0])}</h1>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">@{(name || 'jugador').toLowerCase().replace(/\s+/g, '')}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1 truncate">
                <IconMail size={11} className="shrink-0" /> {user.email}
              </p>
            </div>
          </div>
          {globalStats?.rank && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mt-3 whitespace-nowrap"
              style={{ background: 'rgba(242,183,5,0.15)', color: 'var(--color-light-amber)', border: '1px solid rgba(242,183,5,0.4)' }}
            >
              <IconMedal size={13} className="shrink-0" /> #{globalStats.rank} en el ranking
            </span>
          )}
        </div>

        {globalStats?.rank && (
          <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-3 h-full flex flex-col justify-center">
            <p className="text-[9px] font-semibold text-[var(--color-light-amber)] tracking-wide mb-1 whitespace-nowrap">RANKING GLOBAL</p>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-display text-2xl font-800">#{globalStats.rank}</span>
              <IconMedal size={16} className="text-[var(--color-light-amber)]" />
            </div>
            <p className="text-[9px] text-[var(--color-text-muted)] mb-2 leading-tight">
              {globalStats.rank === 1 ? '¡Vas primero!' : `Estas a ${pointsToFirst} pts del #1`}
            </p>
            <div className="h-1.5 rounded-full bg-[var(--color-field-line)] overflow-hidden mb-1">
              <div className="h-full rounded-full bg-[var(--color-light-amber)]" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-[var(--color-text-muted)]">
              <span>0</span><span>{globalStats.topPoints}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4 tarjetas */}
      {loadingStats ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando estadisticas...</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 w-full">
          {[
            { icon: <IconStar size={16} />, value: globalStats?.points ?? 0, label: 'PUNTOS' },
            { icon: <IconTarget size={16} />, value: `${winRate}%`, label: 'ACIERTOS' },
            { icon: <IconUsers size={16} />, value: groupCount, label: 'QUINIELAS' },
            { icon: <IconFlame size={16} />, value: globalStats?.streak ?? 0, label: 'RACHA' },
          ].map((c, i) => (
            <div key={i} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-3 text-center">
              <div className="text-[var(--color-light-amber)] flex items-center justify-center mb-1.5">
                {c.icon}
              </div>
              <div className="font-mono-score text-xl font-700">{c.value}</div>
              <div className="text-[8px] text-[var(--color-text-muted)] mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Equipo favorito */}
      <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 relative overflow-hidden">
        {team && (
          <img src={teamLogoUrl(team)} alt="" className="absolute -right-3 -bottom-3 w-20 h-20 object-contain opacity-[0.06] pointer-events-none select-none z-0" />
        )}
        <div className="relative z-10">
          <p className="text-[10px] font-semibold text-[var(--color-light-amber)] tracking-wide mb-2">MI EQUIPO FAVORITO</p>
          {team ? (
            <div className="flex items-center gap-3">
              <img src={teamLogoUrl(team)} alt={team} className="w-10 h-10 object-contain shrink-0" />
              <div>
                <p className="font-semibold text-sm">{team}</p>
                <button onClick={() => setShowEdit(true)} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] underline">
                  Cambiar equipo
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowEdit(true)} className="text-sm text-[var(--color-light-amber)] hover:underline">
              + Elige tu equipo favorito
            </button>
          )}
        </div>
      </div>

      {/* Mi rendimiento */}
      <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4">
        <p className="text-[10px] font-semibold text-[var(--color-light-amber)] tracking-wide mb-3">MI RENDIMIENTO</p>
        {loadingStats ? (
          <p className="text-xs text-[var(--color-text-muted)]">Cargando...</p>
        ) : chartData.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">Haz tus primeras predicciones para ver tu progreso aqui.</p>
        ) : chartData.length === 1 ? (
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">% de aciertos esta semana</p>
            <p className="font-mono-score text-3xl font-700 text-[var(--color-light-amber)]">{curAccuracy}%</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Vuelve la proxima semana para ver como va cambiando tu progreso.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <p className="text-[10px] text-[var(--color-text-muted)]">% de aciertos</p>
              <p className="font-mono-score text-3xl font-700 text-[var(--color-light-amber)]">{curAccuracy}%</p>
              {delta != null && (
                <p className="text-[10px] mt-1" style={{ color: delta >= 0 ? '#3D8B5F' : 'var(--color-scoreboard-red)' }}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs semana anterior
                </p>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <MiniLineChart data={chartData} />
            </div>
          </div>
        )}
      </div>

      {/* Lista de configuracion */}
      <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg divide-y divide-[var(--color-field-line)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <IconBell size={18} className="text-[var(--color-light-amber)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Notificaciones</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Gestiona los avisos y recordatorios</p>
          </div>
          <button
            onClick={togglePush}
            disabled={pushBusy || !pushSupported()}
            aria-label="Activar o desactivar notificaciones"
            className="w-11 h-6 rounded-full relative transition disabled:opacity-50 shrink-0"
            style={{ background: pushEnabled ? '#3D8B5F' : 'var(--color-field-line)' }}
          >
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: pushEnabled ? '22px' : '2px' }} />
          </button>
        </div>

        <button onClick={() => setShowSecurity(true)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-field-surface-raised)] transition text-left">
          <IconShield size={18} className="text-[var(--color-light-amber)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Seguridad</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Cambia tu contrasena y administra tu cuenta</p>
          </div>
          <IconChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
        </button>
      </div>

      {showLeaveGroup && (
        <button
          onClick={onLeaveGroup}
          className="w-full text-sm font-semibold rounded-md py-2.5 border border-[var(--color-scoreboard-red)]/40 text-[var(--color-scoreboard-red)] hover:bg-[var(--color-scoreboard-red)]/10 transition"
        >
          Salir de {activeGroupName ? `"${activeGroupName}"` : 'esta liga'}
        </button>
      )}

      <button
        onClick={() => supabase.auth.signOut()}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-lg py-3 bg-[rgba(228,70,43,0.1)] border border-[var(--color-scoreboard-red)]/40 text-[var(--color-scoreboard-red)] hover:bg-[rgba(228,70,43,0.18)] transition"
      >
        <IconLogout size={16} /> Cerrar sesion
      </button>

      {showEdit && (
        <EditProfileModal
          user={user}
          name={name}
          team={team}
          onSaved={(n, t) => { setName(n); setTeam(t) }}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showSecurity && <SecurityModal onClose={() => setShowSecurity(false)} />}
    </div>
  )
}