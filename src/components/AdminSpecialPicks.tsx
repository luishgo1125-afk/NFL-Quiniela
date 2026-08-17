import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group, SpecialCategory } from '../lib/types'

function CategoryRow({ category, onChange }: { category: SpecialCategory; onChange: () => void }) {
  const [correctAnswer, setCorrectAnswer] = useState(category.correct_answer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolve() {
    if (!correctAnswer) return
    if (!confirm(`¿Marcar "${correctAnswer}" como la respuesta correcta? Esto calcula los puntos de todos y cierra la categoria.`)) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('resolve_special_category', {
      p_category_id: category.id,
      p_correct_answer: correctAnswer,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onChange()
  }

  async function lockOnly() {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('lock_special_category', { p_category_id: category.id })
    setBusy(false)
    if (err) { setError(err.message); return }
    onChange()
  }

  async function remove() {
    if (!confirm(`¿Borrar la categoria "${category.title}"? Se perderan las predicciones de todos.`)) return
    setBusy(true)
    await supabase.from('special_categories').delete().eq('id', category.id)
    setBusy(false)
    onChange()
  }

  return (
    <div className="bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{category.title}</span>
        <span className="text-[10px] font-mono-score text-[var(--color-text-muted)]">{category.points} pts</span>
      </div>

      {category.locked ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          {category.correct_answer ? `Resuelta: ${category.correct_answer}` : 'Bloqueada, sin resolver todavia.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <select
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            className="flex-1 min-w-[140px] bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-md px-2 py-1.5 text-xs outline-none focus:border-[var(--color-light-amber)]"
          >
            <option value="">Marcar respuesta correcta...</option>
            {category.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={resolve} disabled={busy || !correctAnswer} className="text-xs font-semibold rounded-md px-3 py-1.5 bg-[var(--color-turf-green)] text-white hover:brightness-110 disabled:opacity-50">
            Resolver
          </button>
          <button onClick={lockOnly} disabled={busy} className="text-xs font-semibold rounded-md px-3 py-1.5 border border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] disabled:opacity-50">
            Solo bloquear
          </button>
          <button onClick={remove} disabled={busy} className="text-xs text-[var(--color-scoreboard-red)] hover:underline">
            Borrar
          </button>
        </div>
      )}
      {error && <p className="text-[var(--color-scoreboard-red)] text-xs">{error}</p>}
    </div>
  )
}

export default function AdminSpecialPicks({ group, onGroupUpdated }: { group: Group; onGroupUpdated: (g: Group) => void }) {
  const [categories, setCategories] = useState<SpecialCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [points, setPoints] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [togglingEnabled, setTogglingEnabled] = useState(false)

  async function toggleEnabled() {
    setTogglingEnabled(true)
    const { data, error: err } = await supabase.rpc('set_special_picks_enabled', {
      p_group_id: group.id,
      p_enabled: !group.special_picks_enabled,
    })
    setTogglingEnabled(false)
    if (!err && data) onGroupUpdated(data)
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('special_categories').select('*').eq('group_id', group.id).order('created_at')
    setCategories(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [group.id])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const options = optionsText.split(',').map((o) => o.trim()).filter(Boolean)
    if (options.length < 2) { setError('Pon al menos 2 opciones separadas por coma'); return }
    setBusy(true)
    const { error: err } = await supabase.from('special_categories').insert({
      group_id: group.id,
      title,
      options,
      points,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setTitle('')
    setOptionsText('')
    load()
  }

  return (
    <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Predicciones especiales de temporada</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Cosas como "campeon del Super Bowl" o "MVP de la temporada" — separadas de las predicciones semanales.
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={togglingEnabled}
            aria-label="Activar o desactivar predicciones especiales"
            className="shrink-0 ml-3 w-11 h-6 rounded-full relative transition disabled:opacity-50"
            style={{ background: group.special_picks_enabled ? '#3D8B5F' : 'var(--color-field-line)' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: group.special_picks_enabled ? '22px' : '2px' }}
            />
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
          {group.special_picks_enabled
            ? 'Activadas — la pestana "Especiales" es visible para todos.'
            : 'Desactivadas — nadie ve la pestana "Especiales" (puedes seguir preparando categorias aqui mientras tanto).'}
        </p>
      </div>

      <form onSubmit={create} className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='Titulo, ej. "Campeon del Super Bowl"'
          required
          className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
        />
        <input
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          placeholder="Opciones separadas por coma, ej. KC, SF, BUF, PHI"
          required
          className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--color-text-muted)] shrink-0">Puntos si aciertan:</label>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-20 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-2 py-1 text-sm outline-none focus:border-[var(--color-light-amber)]"
          />
        </div>
        {error && <p className="text-xs text-[var(--color-scoreboard-red)]">{error}</p>}
        <button type="submit" disabled={busy} className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50">
          Agregar categoria
        </button>
      </form>

      <div className="space-y-2">
        {loading ? (
          <p className="text-xs text-[var(--color-text-muted)]">Cargando...</p>
        ) : categories.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">Ninguna todavia.</p>
        ) : (
          categories.map((c) => <CategoryRow key={c.id} category={c} onChange={load} />)
        )}
      </div>
    </div>
  )
}
