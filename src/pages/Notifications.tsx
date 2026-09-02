import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconBell, IconCheck, IconStar, IconTarget, IconClipboardX, IconTrophy, IconUsers, IconClock } from '../components/icons'
import type { User } from '@supabase/supabase-js'

interface NotificationItem {
  id: string
  title: string
  body: string
  url: string | null
  read_at: string | null
  created_at: string
}

type Category = 'quinielas' | 'resultados' | 'sistema'
type IconKind = 'star' | 'target' | 'miss' | 'trophy' | 'users' | 'clock' | 'bell'

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

function NotifIcon({ kind, size = 16 }: { kind: IconKind; size?: number }) {
  switch (kind) {
    case 'star': return <IconStar size={size} />
    case 'target': return <IconTarget size={size} />
    case 'miss': return <IconClipboardX size={size} />
    case 'trophy': return <IconTrophy size={size} />
    case 'users': return <IconUsers size={size} />
    case 'clock': return <IconClock size={size} />
    default: return <IconBell size={size} />
  }
}

// La tabla notifications no trae una categoria propia, asi que la inferimos
// del texto (titulo/cuerpo) para poder filtrar y ponerle un icono a cada una.
// Mismo estilo que las tarjetas de estadisticas de Perfil: icono de contorno
// sobre un cuadro oscuro neutro, sin circulos de color rellenos.
function classify(n: NotificationItem): { cat: Category; icon: IconKind; color: string } {
  const text = `${n.title} ${n.body}`.toLowerCase()
  if (text.includes('no sumaste puntos') || text.includes('perdiste')) {
    return { cat: 'resultados', icon: 'miss', color: 'var(--color-scoreboard-red)' }
  }
  if (text.includes('ganaste puntos') || text.includes('acertaste')) {
    return { cat: 'resultados', icon: 'star', color: 'var(--color-light-amber)' }
  }
  if (text.includes('ranking') || text.includes('posicion') || text.includes('posición')) {
    return { cat: 'resultados', icon: 'trophy', color: 'var(--color-light-amber)' }
  }
  if (text.includes('resultado de tu prediccion') || text.includes('resultado de tu predicción') || text.includes('termino') || text.includes('terminó')) {
    return { cat: 'resultados', icon: 'target', color: '#3D8B5F' }
  }
  if (text.includes('se unio') || text.includes('se unió') || text.includes('nueva quiniela')) {
    return { cat: 'sistema', icon: 'users', color: 'var(--color-text-muted)' }
  }
  if (text.includes('cierra') || text.includes('pendiente') || text.includes('abre')) {
    return { cat: 'quinielas', icon: 'clock', color: 'var(--color-light-amber)' }
  }
  return { cat: 'sistema', icon: 'bell', color: 'var(--color-text-muted)' }
}

const FILTERS: { key: 'todas' | Category; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'quinielas', label: 'Quinielas' },
  { key: 'resultados', label: 'Resultados' },
  { key: 'sistema', label: 'Sistema' },
]

export default function Notifications({ user, onOpenGame }: { user: User; onOpenGame?: (gameId: string) => void }) {
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todas' | Category>('todas')

  async function loadNotifs() {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, url, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60)
    setNotifs(data ?? [])
  }

  useEffect(() => {
    loadNotifs().finally(() => setLoading(false))
  }, [user.id])

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => loadNotifs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const classified = useMemo(() => notifs.map((n) => ({ n, ...classify(n) })), [notifs])

  const counts = useMemo(() => {
    const c: Record<'todas' | Category, number> = { todas: classified.length, quinielas: 0, resultados: 0, sistema: 0 }
    classified.forEach((x) => { c[x.cat]++ })
    return c
  }, [classified])

  const filtered = filter === 'todas' ? classified : classified.filter((x) => x.cat === filter)
  const nuevas = filtered.filter((x) => !x.n.read_at)
  const anteriores = filtered.filter((x) => x.n.read_at)
  const hasUnread = classified.some((x) => !x.n.read_at)

  async function markRead(n: NotificationItem) {
    if (n.read_at) return
    const now = new Date().toISOString()
    await supabase.from('notifications').update({ read_at: now }).eq('id', n.id)
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)))
  }

  function handleTap(n: NotificationItem) {
    markRead(n)
    // por ahora "url" solo guarda el id del partido (uuid), no una ruta real
    if (n.url) onOpenGame?.(n.url)
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    const unreadIds = notifs.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ read_at: now }).in('id', unreadIds)
    setNotifs((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
  }

  function renderCard(item: { n: NotificationItem; cat: Category; icon: IconKind; color: string }) {
    const { n, icon, color } = item
    const [line1, line2] = n.body.split('\n')
    const unread = !n.read_at
    return (
      <button
        key={n.id}
        onClick={() => handleTap(n)}
        className="w-full text-left bg-[var(--color-field-surface)] border rounded-lg pl-4 pr-3 py-3 transition flex items-center gap-3.5"
        style={{ borderColor: unread ? 'var(--color-light-amber)' : 'var(--color-field-line)' }}
      >
        <span
          className="w-9 h-9 rounded-lg bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center shrink-0"
          style={{ color }}
        >
          <NotifIcon kind={icon} size={17} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold flex items-center gap-2 min-w-0">
              {unread && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-light-amber)] shrink-0" />}
              <span className={`truncate ${unread ? '' : 'text-[var(--color-text-muted)] font-medium'}`}>{n.title}</span>
            </p>
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono-score shrink-0">{timeAgo(n.created_at)}</span>
          </div>
          {line1 && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{line1}</p>}
          {line2 && <p className="text-[10px] text-[var(--color-text-muted)]/80 mt-0.5">{line2}</p>}
        </div>
        <span className="text-[var(--color-text-muted)] shrink-0 text-lg">›</span>
      </button>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="font-display text-4xl font-800">NOTIFICACIONES</h1>
          <p className="text-[var(--color-text-muted)] text-sm">Tus avisos y la actividad reciente de tus ligas</p>
        </div>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-light-amber)] hover:underline whitespace-nowrap mt-1"
          >
            Marcar todas como leidas <IconCheck size={13} />
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap my-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition ${
              filter === f.key
                ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.12)] text-[var(--color-light-amber)]'
                : 'border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)]'
            }`}
          >
            {f.label}
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono-score"
              style={{
                background: filter === f.key ? 'var(--color-light-amber)' : 'var(--color-field-surface-raised)',
                color: filter === f.key ? 'var(--color-field-night)' : 'var(--color-text-muted)',
              }}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : notifs.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-[var(--color-field-line)] rounded-lg">
          <IconBell size={28} className="text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-[var(--color-text-muted)] text-sm">Todavia no tienes avisos.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm text-center py-8">No hay notificaciones en esta categoria.</p>
      ) : (
        <div className="space-y-6">
          {nuevas.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-light-amber)]">Nuevas</h2>
              <div className="space-y-2">{nuevas.map(renderCard)}</div>
            </div>
          )}
          {anteriores.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Anteriores</h2>
              <div className="space-y-2">{anteriores.map(renderCard)}</div>
            </div>
          )}
          <p className="text-center text-xs text-[var(--color-text-muted)] pt-2">No hay mas notificaciones 🎉</p>
        </div>
      )}
    </div>
  )
}
