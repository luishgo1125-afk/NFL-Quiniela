import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtMoney, type BalanceEntry } from '../lib/balance'
import { weekLabel, type Group } from '../lib/types'
import { tr, localeTag } from '../i18n'

interface Section {
  key: string
  title: string
  entries: BalanceEntry[]
  subtotal: number
  running: number
}

function kindLabel(e: BalanceEntry): string {
  if (e.kind === 'entry') return tr('Cuota de participacion')
  if (e.kind === 'prize') return tr('Premio')
  if (e.kind === 'payment') return tr('Pago en efectivo')
  if (e.kind === 'settlement') return tr('Saldo retirado')
  return tr('Ajuste')
}

// 'w:2026:2:8' -> [2026, 2, 8]; cualquier otra cosa -> null
function parseWeekRef(ref: string): [number, number, number] | null {
  if (!ref.startsWith('w:')) return null
  const p = ref.slice(2).split(':').map(Number)
  return p.length === 3 && p.every((n) => Number.isFinite(n)) ? [p[0], p[1], p[2]] : null
}

export default function BalanceLedgerModal({
  group, userId, name, onClose, onChanged,
}: {
  group: Group
  userId: string
  name: string
  onClose: () => void
  onChanged: () => void
}) {
  const [entries, setEntries] = useState<BalanceEntry[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjNote, setAdjNote] = useState('')

  async function load() {
    const { data } = await supabase
      .from('balance_entries')
      .select('*')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    setEntries(((data ?? []) as any[]).map((e) => ({ ...e, amount: Number(e.amount) })) as BalanceEntry[])
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [group.id, userId])

  // jornada tras jornada: cada jornada es una seccion con su subtotal y el saldo acumulado
  const { sections, total } = useMemo(() => {
    const weekMap = new Map<string, { sortKey: number; ref: [number, number, number]; entries: BalanceEntry[] }>()
    const others: BalanceEntry[] = []
    ;(entries ?? []).forEach((e) => {
      const w = parseWeekRef(e.ref_key)
      if (!w) { others.push(e); return }
      const k = e.ref_key
      if (!weekMap.has(k)) weekMap.set(k, { sortKey: w[0] * 10000 + w[1] * 100 + w[2], ref: w, entries: [] })
      weekMap.get(k)!.entries.push(e)
    })
    const order = (e: BalanceEntry) => ({ entry: 0, payment: 1, prize: 2, adjustment: 3, settlement: 4 } as Record<string, number>)[e.kind] ?? 5
    const list: Section[] = []
    let running = 0
    Array.from(weekMap.entries())
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .forEach(([k, v]) => {
        const es = v.entries.slice().sort((a, b) => order(a) - order(b))
        const subtotal = Math.round(es.reduce((a, e) => a + e.amount, 0) * 100) / 100
        running = Math.round((running + subtotal) * 100) / 100
        list.push({ key: k, title: weekLabel(v.ref[1], v.ref[2]), entries: es, subtotal, running })
      })
    if (others.length) {
      const es = others.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
      const subtotal = Math.round(es.reduce((a, e) => a + e.amount, 0) * 100) / 100
      running = Math.round((running + subtotal) * 100) / 100
      list.push({ key: 'otros', title: group.scoring_mode === 'weekly' ? tr('Ajustes y retiros') : tr('Liga completa, ajustes y retiros'), entries: es, subtotal, running })
    }
    return { sections: list, total: running }
  }, [entries, group.scoring_mode])

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) { alert(error.message); return false }
    await load()
    onChanged()
    return true
  }

  async function addAdjustment() {
    const n = Number(adjAmount)
    if (!Number.isFinite(n) || n === 0) { alert(tr('Escribe un monto distinto de cero (negativo para restar).')); return }
    const ok = await run(() => supabase.rpc('admin_add_balance_adjustment', { p_group_id: group.id, p_user_id: userId, p_amount: n, p_note: adjNote }))
    if (ok) { setAdjAmount(''); setAdjNote('') }
  }

  async function saveEdit() {
    if (!editId) return
    const n = Number(editAmount)
    if (!Number.isFinite(n) || n === 0) { alert(tr('Escribe un monto distinto de cero (negativo para restar).')); return }
    const ok = await run(() => supabase.rpc('admin_update_balance_entry', { p_entry_id: editId, p_amount: n, p_note: editNote }))
    if (ok) setEditId(null)
  }

  async function removeEntry(e: BalanceEntry) {
    if (!window.confirm(tr('¿Borrar este movimiento ({amount})?', { amount: fmtMoney(e.amount) }))) return
    await run(() => supabase.rpc('admin_delete_balance_entry', { p_entry_id: e.id }))
  }

  const inputCls = 'w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 sm:px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-t-2xl sm:rounded-lg p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold truncate">{name}</h3>
            <p className="text-[10px] text-[var(--color-text-muted)]">{group.name} · {tr('Saldo jornada por jornada')}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono-score text-xl font-800" style={{ color: total < 0 ? 'var(--color-scoreboard-red)' : total > 0 ? 'var(--color-turf-green)' : undefined }}>{fmtMoney(total)}</p>
            <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-xs">{tr('Cerrar')}</button>
          </div>
        </div>

        {/* ajuste manual */}
        <div className="rounded-lg border border-[var(--color-field-line)] p-3 space-y-2">
          <p className="text-xs font-semibold">{tr('Agregar ajuste')}</p>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder={tr('Monto (+/-)')} className={`${inputCls} w-32 shrink-0`} />
            <input value={adjNote} maxLength={120} onChange={(e) => setAdjNote(e.target.value)} placeholder={tr('Nota (opcional)')} className={inputCls} />
          </div>
          <button onClick={addAdjustment} disabled={busy} className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm disabled:opacity-50">
            {tr('Agregar ajuste')}
          </button>
        </div>

        {entries === null ? (
          <p className="text-xs text-[var(--color-text-muted)]">{tr('Cargando...')}</p>
        ) : sections.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">{tr('Este jugador aun no tiene movimientos.')}</p>
        ) : (
          <div className="space-y-3">
            {sections.map((sec) => (
              <div key={sec.key} className="rounded-lg border border-[var(--color-field-line)] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-field-surface-raised)]">
                  <span className="text-xs font-bold tracking-wide">{sec.title}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {tr('Jornada')}: <b className="font-mono-score" style={{ color: sec.subtotal < 0 ? 'var(--color-scoreboard-red)' : sec.subtotal > 0 ? 'var(--color-turf-green)' : undefined }}>{fmtMoney(sec.subtotal)}</b>
                    {' · '}{tr('Acumulado')}: <b className="font-mono-score">{fmtMoney(sec.running)}</b>
                  </span>
                </div>
                <div className="divide-y divide-[var(--color-field-line)]">
                  {sec.entries.map((e) => (
                    <div key={e.id} className="px-3 py-2">
                      {editId === e.id ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input type="number" inputMode="decimal" step="0.01" value={editAmount} onChange={(ev) => setEditAmount(ev.target.value)} className={`${inputCls} w-32 shrink-0`} />
                            <input value={editNote} maxLength={120} onChange={(ev) => setEditNote(ev.target.value)} placeholder={tr('Nota')} className={inputCls} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEdit} disabled={busy} className="flex-1 bg-[var(--color-light-amber)] text-black font-semibold rounded-md py-1.5 text-xs disabled:opacity-50">{tr('Guardar')}</button>
                            <button onClick={() => setEditId(null)} className="flex-1 border border-[var(--color-field-line)] rounded-md py-1.5 text-xs">{tr('Cancelar')}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs truncate">{kindLabel(e)}{e.kind === 'adjustment' && e.note ? ` · ${e.note}` : ''}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)]">{new Date(e.created_at).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' })}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono-score text-sm font-semibold" style={{ color: e.amount < 0 ? 'var(--color-scoreboard-red)' : 'var(--color-turf-green)' }}>
                              {e.amount > 0 ? '+' : ''}{fmtMoney(e.amount)}
                            </span>
                            <button onClick={() => { setEditId(e.id); setEditAmount(String(e.amount)); setEditNote(e.kind === 'adjustment' ? (e.note ?? '') : '') }} className="text-[10px] text-[var(--color-light-amber)] hover:underline">{tr('Editar')}</button>
                            {e.kind !== 'entry' && e.kind !== 'payment' && (
                              <button onClick={() => removeEntry(e)} disabled={busy} className="text-[10px] text-[var(--color-scoreboard-red)] hover:underline">{tr('Borrar')}</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
