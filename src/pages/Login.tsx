import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: signErr } = await supabase.auth.signUp({ email, password })
        if (signErr) throw signErr
        if (data.user) {
          await supabase.from('profiles').insert({ id: data.user.id, display_name: displayName || email.split('@')[0] })
        }
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signErr) throw signErr
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salio mal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="font-mono-score text-[var(--color-light-amber)] text-sm tracking-widest">WK 01</span>
          </div>
          <h1 className="font-display text-5xl font-800 leading-none tracking-tight">
            QUINIELA<span className="text-[var(--color-light-amber)]">.</span>
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-2">Predicciones NFL entre amigos</p>
        </div>

        <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-6">
          <div className="flex mb-6 rounded-md overflow-hidden border border-[var(--color-field-line)]">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'signin' ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Tu nombre"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              />
            )}
            <input
              type="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            />
            <input
              type="password"
              placeholder="Contrasena"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            />
            {error && <p className="text-[var(--color-scoreboard-red)] text-xs">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 transition disabled:opacity-50"
            >
              {busy ? 'Un momento...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
