import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyBalanceEntries, fmtMoney, sumEntries, type BalanceEntry } from '../lib/balance'
import { tr, localeTag } from '../i18n'
import { IconCoin } from './icons'

function kindLabel(e: BalanceEntry): string {
  if (e.kind === 'entry') return tr('Cuota de participacion')
  if (e.kind === 'prize') return tr('Premio')
  if (e.kind === 'payment') return tr('Pago en efectivo')
  if (e.kind === 'adjustment') return e.note || tr('Ajuste')
  return tr('Saldo retirado')
}

export default function BalanceCard({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<BalanceEntry[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let alive = true
    fetchMyBalanceEntries(userId).then(async (es) => {
      if (!alive) return
      setEntries(es)
      const ids = Array.from(new Set(es.map((e) => e.group_id)))
      if (ids.length) {
        const { data } = await supabase.from('groups').select('id, name').in('id', ids)
        if (alive) setNames(Object.fromEntries((data ?? []).map((g: any) => [g.id, g.name])))
      }
    })
    return () => { alive = false }
  }, [userId])

  if (!entries || entries.length === 0) return null

  const total = sumEntries(entries)
  const byGroup = new Map<string, BalanceEntry[]>()
  entries.forEach((e) => byGroup.set(e.group_id, [...(byGroup.get(e.group_id) ?? []), e]))
  const shown = showAll ? entries : entries.slice(0, 6)
  const color = total < 0 ? 'var(--color-scoreboard-red)' : total > 0 ? 'var(--color-turf-green)' : 'var(--color-text-primary)'

  return (
    <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold text-[var(--color-light-amber)] tracking-wide flex items-center gap-1.5">
          <IconCoin size={13} /> {tr('MI SALDO')}
        </p>
        <span className="font-mono-score text-2xl font-800" style={{ color }}>{fmtMoney(total)}</span>
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] leading-snug">
        {tr('Saldo virtual con fines didacticos: se resta la cuota al participar y se suma lo que ganas. Si pagas en efectivo se acredita tu cuota; si el administrador retira tu saldo, vuelve a cero; o puedes usarlo para pagar tus siguientes jornadas.')}
      </p>

      {byGroup.size > 1 && (
        <div className="space-y-1">
          {Array.from(byGroup.entries()).map(([gid, es]) => (
            <div key={gid} className="flex items-center justify-between text-xs">
              <span className="truncate text-[var(--color-text-muted)]">{names[gid] ?? tr('Liga')}</span>
              <span className="font-mono-score font-semibold">{fmtMoney(sumEntries(es))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--color-field-line)] pt-2 space-y-1.5">
        {shown.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate">{kindLabel(e)} <span className="text-[var(--color-text-muted)]">· {names[e.group_id] ?? ''}</span></p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{new Date(e.created_at).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' })}</p>
            </div>
            <span className="font-mono-score font-semibold shrink-0" style={{ color: e.amount < 0 ? 'var(--color-scoreboard-red)' : 'var(--color-turf-green)' }}>
              {e.amount > 0 ? '+' : ''}{fmtMoney(e.amount)}
            </span>
          </div>
        ))}
        {entries.length > 6 && (
          <button onClick={() => setShowAll((v) => !v)} className="text-[11px] text-[var(--color-light-amber)] hover:underline">
            {showAll ? tr('Ver menos') : tr('Ver todos los movimientos')}
          </button>
        )}
      </div>
    </div>
  )
}
