import { useEffect, useRef } from 'react'
import type { Group } from '../lib/types'
import { weekLabel } from '../lib/types'
import { IconClipboard, IconBarChart, IconGear, IconCalendar, IconCopy, IconWhatsapp, IconCoin } from './icons'

export type WeekEntry = { key: string; year: number; seasonType: number; week: number }
export type LeagueTab = 'picks' | 'tabla' | 'admin'

/* ---------- Nivel 1: identidad ---------- */
export function LeagueIdentity({
  group, selectedWeek, liveCount, memberCount, copiedCode, onCopyCode, isAdmin, adminActive, onOpenAdmin,
}: {
  group: Group
  selectedWeek: WeekEntry | null
  liveCount: number
  memberCount: number
  copiedCode: boolean
  onCopyCode: () => void
  isAdmin: boolean
  adminActive: boolean
  onOpenAdmin: () => void
}) {
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Unete a mi quiniela "${group.name}" en Quiniela NFL: ${window.location.origin}${window.location.pathname}?join=${group.invite_code}`
  )}`
  return (
    <div className="lh-identity">
      {group.logo_url ? (
        <img src={group.logo_url} alt={group.name} className="lh-logo" />
      ) : (
        <div className="lh-logo lh-logo-fallback">🏈</div>
      )}
      <div className="lh-id-main">
        <h1 className="lh-title">
          <span className="lh-title-text">{group.name}</span>
          {selectedWeek && <span className="lh-week-badge">{weekLabel(selectedWeek.seasonType, selectedWeek.week)}</span>}
          {liveCount > 0 && (
            <span className="lh-live">
              <span className="lh-live-dot" /> EN VIVO
            </span>
          )}
        </h1>
        <p className="lh-meta">
          <span>#{group.invite_code}</span>
          <span className="lh-dot">•</span>
          <span>{memberCount} miembro{memberCount !== 1 ? 's' : ''}</span>
          <button onClick={onCopyCode} aria-label="Copiar codigo de invitacion" title="Copiar codigo" className="lh-icon-btn">
            {copiedCode ? <span className="lh-copied">✓</span> : <IconCopy size={13} />}
          </button>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" aria-label="Compartir por WhatsApp" title="Compartir por WhatsApp" className="lh-icon-btn lh-wa">
            <IconWhatsapp />
          </a>
        </p>
      </div>
      {isAdmin && (
        <button
          onClick={onOpenAdmin}
          aria-label="Administrar liga"
          title="Administrar"
          className={`lh-icon-btn lh-gear ${adminActive ? 'active' : ''}`}
        >
          <IconGear size={17} />
        </button>
      )}
    </div>
  )
}

/* ---------- Nivel 2: tabs ---------- */
export function LeagueTabs({ tab, onChange }: { tab: LeagueTab; onChange: (t: 'picks' | 'tabla') => void }) {
  const items = [
    { id: 'picks' as const, label: 'Predicciones', icon: <IconClipboard size={16} /> },
    { id: 'tabla' as const, label: 'Tabla', icon: <IconBarChart size={16} /> },
  ]
  return (
    <div className="lt-bar" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={tab === it.id}
          onClick={() => onChange(it.id)}
          className={`lt-tab ${tab === it.id ? 'active' : ''}`}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ---------- Nivel 3: selector de semanas ---------- */
export function WeekSelector({
  weeks, weekKey, onSelect, multiYear, disabled,
}: {
  weeks: WeekEntry[]
  weekKey: string | null
  onSelect: (key: string) => void
  multiYear: boolean
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  // mantiene la semana activa a la vista en el scroll horizontal (sin mover la pagina)
  useEffect(() => {
    const box = ref.current
    if (!box || !weekKey) return
    const el = box.querySelector<HTMLElement>('[data-active="true"]')
    if (!el) return
    const target = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2
    box.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [weekKey, weeks.length])

  return (
    <div ref={ref} className={`wk-scroll ${disabled ? 'is-disabled' : ''}`}>
      {weeks.map((w) => {
        const active = weekKey === w.key
        return (
          <button
            key={w.key}
            data-active={active}
            onClick={() => !disabled && onSelect(w.key)}
            tabIndex={disabled ? -1 : 0}
            className={`wk-pill ${active ? 'active' : ''}`}
          >
            <IconCalendar size={12} className="shrink-0" />
            <span>{weekLabel(w.seasonType, w.week).replace(/\s*\d+$/, '')}</span>
            {w.seasonType !== 3 && <span className="wk-num">{w.week}</span>}
            {multiYear && <span className="wk-year">· {w.year}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Premio total (badge) ---------- */
export function PrizeSummary({ amount }: { amount: number }) {
  if (amount <= 0) return null
  return (
    <div className="prize-badge" title="Premio total">
      <IconCoin size={14} />
      <span className="prize-label">Premio total</span>
      <span className="prize-amount">${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
    </div>
  )
}

/* ---------- Composicion completa ---------- */
export default function LeagueHeader(props: {
  group: Group
  tab: LeagueTab
  onTabChange: (t: 'picks' | 'tabla') => void
  weeks: WeekEntry[]
  weekKey: string | null
  onSelectWeek: (key: string) => void
  multiYear: boolean
  selectedWeek: WeekEntry | null
  liveCount: number
  memberCount: number
  copiedCode: boolean
  onCopyCode: () => void
  isAdmin: boolean
  onOpenAdmin: () => void
  prize: number
}) {
  const weekDisabled = props.tab === 'tabla' && props.group.scoring_mode !== 'weekly'
  return (
    <header className="lh-root">
      <LeagueIdentity
        group={props.group}
        selectedWeek={props.selectedWeek}
        liveCount={props.liveCount}
        memberCount={props.memberCount}
        copiedCode={props.copiedCode}
        onCopyCode={props.onCopyCode}
        isAdmin={props.isAdmin}
        adminActive={props.tab === 'admin'}
        onOpenAdmin={props.onOpenAdmin}
      />
      <LeagueTabs tab={props.tab} onChange={props.onTabChange} />
      <div className="lh-weeks-row">
        <WeekSelector weeks={props.weeks} weekKey={props.weekKey} onSelect={props.onSelectWeek} multiYear={props.multiYear} disabled={weekDisabled} />
        <PrizeSummary amount={props.prize} />
      </div>
    </header>
  )
}
