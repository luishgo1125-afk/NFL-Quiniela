import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group, SpecialCategory, SpecialPick } from '../lib/types'

interface Row {
  category: SpecialCategory
  myPick: SpecialPick | null
}

function CategoryCard({ row, userId, onSaved }: { row: Row; userId: string; onSaved: () => void }) {
  const { category, myPick } = row
  const [answer, setAnswer] = useState(myPick?.answer ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (!answer) return
    setSaving(true)
    const { error } = await supabase
      .from('special_picks')
      .upsert({ category_id: category.id, user_id: userId, answer }, { onConflict: 'category_id,user_id' })
    setSaving(false)
    if (!error) {
      setSaved(true)
      onSaved()
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const confirmed = myPick?.answer === answer && answer !== ''
  const resolved = category.locked && category.correct_answer != null

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: resolved ? (myPick?.points ? '#3D8B5F' : 'var(--color-field-line)') : confirmed ? '#3D8B5F' : 'var(--color-field-line)',
        background: 'var(--color-field-surface)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{category.title}</h3>
        <span className="text-[10px] font-mono-score text-[var(--color-text-muted)]">{category.points} pts</span>
      </div>

      {resolved ? (
        <div className="text-sm">
          <p className="text-[var(--color-text-muted)]">
            Respuesta correcta: <span className="text-[var(--color-light-amber)] font-semibold">{category.correct_answer}</span>
          </p>
          {myPick && (
            <p className="mt-1">
              Tu prediccion: <strong>{myPick.answer}</strong>
              {myPick.points ? (
                <span className="ml-2 text-[#3D8B5F] font-semibold">+{myPick.points} pts</span>
              ) : (
                <span className="ml-2 text-[var(--color-text-muted)]">— no acertaste</span>
              )}
            </p>
          )}
        </div>
      ) : category.locked ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          Cerrada. {myPick ? `Tu prediccion: ${myPick.answer}` : 'No participaste.'}
        </p>
      ) : (
        <div className="space-y-2">
          <select
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
          >
            <option value="">Elige una opcion</option>
            {category.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button
            onClick={save}
            disabled={saving || !answer || confirmed}
            className={`w-full text-xs font-semibold rounded-md py-1.5 transition disabled:opacity-70 ${
              confirmed ? 'bg-[#3D8B5F] text-white' : 'bg-[var(--color-light-amber)] text-[var(--color-field-night)] hover:brightness-110'
            }`}
          >
            {saved || confirmed ? 'Guardado ✓' : saving ? 'Guardando...' : 'Guardar prediccion'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function SpecialPicks({ group, userId }: { group: Group; userId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: categories } = await supabase
      .from('special_categories')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at')

    const { data: myPicks } = await supabase
      .from('special_picks')
      .select('*')
      .eq('user_id', userId)

    const picksByCategory: Record<string, SpecialPick> = {}
    ;(myPicks ?? []).forEach((p: any) => { picksByCategory[p.category_id] = p })

    setRows((categories ?? []).map((c: any) => ({ category: c, myPick: picksByCategory[c.id] ?? null })))
    setLoading(false)
  }

  useEffect(() => { load() }, [group.id, userId])

  useEffect(() => {
    const channel = supabase
      .channel(`special-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_categories', filter: `group_id=eq.${group.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_picks' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id])

  if (loading) return <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
  if (rows.length === 0) return <p className="text-[var(--color-text-muted)] text-sm">El administrador aun no agrega predicciones especiales (como campeon del Super Bowl o MVP).</p>

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <CategoryCard key={row.category.id} row={row} userId={userId} onSaved={load} />
      ))}
    </div>
  )
}
