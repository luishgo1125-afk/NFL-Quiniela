import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { NFL_TEAMS } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [favoriteTeam, setFavoriteTeam] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: signErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        })
        if (signErr) throw signErr
        if (data.user) {
          // upsert (no insert): el trigger de la base de datos ya crea la fila
          // del perfil automaticamente al registrarse, asi que un insert normal
          // chocaria con ella y tu nombre real nunca se guardaria
          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: displayName || email.split('@')[0],
            favorite_team: favoriteTeam || null,
          })
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

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setForgotSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="font-mono-score text-[var(--color-light-amber)] text-sm tracking-widest">WK 01</span>
          </div>
          <img src="/logo.png" alt="Quiniela" className="h-14 w-auto mx-auto" />
          <p className="text-[var(--color-text-muted)] text-sm mt-3">Predicciones NFL entre amigos</p>
        </div>

        <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-6">
          {mode !== 'forgot' && (
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
          )}

          {mode === 'forgot' ? (
            forgotSent ? (
              <div className="text-center space-y-3">
                <p className="text-sm">Te mandamos un enlace a <strong>{email}</strong> para restablecer tu contrasena.</p>
                <button onClick={() => { setMode('signin'); setForgotSent(false) }} className="text-xs text-[var(--color-light-amber)] hover:underline">
                  ← Volver a entrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Te mandamos un enlace a tu correo para poner una nueva contrasena.</p>
                <input
                  type="email"
                  placeholder="Correo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                />
                {error && <p className="text-[var(--color-scoreboard-red)] text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 transition disabled:opacity-50"
                >
                  {busy ? 'Enviando...' : 'Enviar enlace'}
                </button>
                <button type="button" onClick={() => setMode('signin')} className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)]">
                  ← Volver
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                  />
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)] block mb-1">Equipo favorito (opcional)</label>
                    <div className="flex items-center gap-2">
                      {favoriteTeam && <img src={teamLogoUrl(favoriteTeam)} alt={favoriteTeam} className="w-7 h-7 object-contain shrink-0" />}
                      <select
                        value={favoriteTeam}
                        onChange={(e) => setFavoriteTeam(e.target.value)}
                        className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                      >
                        <option value="">Sin elegir</option>
                        {NFL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </>
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
              {mode === 'signin' && (
                <button type="button" onClick={() => setMode('forgot')} className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)]">
                  ¿Olvidaste tu contrasena?
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
