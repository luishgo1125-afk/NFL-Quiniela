import { useState } from 'react'
import { tr } from '../i18n'
import { supabase } from '../lib/supabase'
import { NFL_TEAMS } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'

// marcador para insertar un nodo (p. ej. <strong>) dentro de una frase traducida
const MARK = '\u0001'
function withEmail(text: string, email: string) {
  const [a, b = ''] = text.split(MARK)
  return <>{a}<strong>{email}</strong>{b}</>
}

export default function Login({ initialMode = 'signin', onBack }: { initialMode?: 'signin' | 'signup'; onBack?: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [favoriteTeam, setFavoriteTeam] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [signupSent, setSignupSent] = useState(false)

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
        // si no hay sesion todavia, es porque el proyecto pide confirmar el
        // correo antes de dejar entrar (lo mas comun) — avisamos claramente
        if (!data.session) {
          setSignupSent(true)
        }
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signErr) throw signErr
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Algo salio mal'))
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
        {onBack && (
          <button onClick={onBack} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] mb-4">{tr('← Inicio')}</button>
        )}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="font-mono-score text-[var(--color-light-amber)] text-sm tracking-widest"></span>
          </div>
          <img src="/logo.png" alt="Quiniela" className="h-14 w-auto mx-auto" />
          <p className="text-[var(--color-text-muted)] text-sm mt-3">{tr('Predicciones NFL entre amigos')}</p>
        </div>

        <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-6">
          {mode !== 'forgot' && !(mode === 'signup' && signupSent) && (
            <div className="flex mb-6 rounded-md overflow-hidden border border-[var(--color-field-line)]">
              <button
                onClick={() => setMode('signin')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'signin' ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
              >
                {tr('Entrar')}
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
              >
                {tr('Crear cuenta')}
              </button>
            </div>
          )}

          {mode === 'forgot' ? (
            forgotSent ? (
              <div className="text-center space-y-3">
                <p className="text-sm">{withEmail(tr('Te mandamos un enlace a {email} para restablecer tu contrasena.', { email: MARK }), email)}</p>
                <button onClick={() => { setMode('signin'); setForgotSent(false) }} className="text-xs text-[var(--color-light-amber)] hover:underline">
                  {tr('← Volver a entrar')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">{tr('Te mandamos un enlace a tu correo para poner una nueva contrasena.')}</p>
                <input
                  type="email"
                  placeholder={tr('Correo')}
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
                  {busy ? tr('Enviando...') : tr('Enviar enlace')}
                </button>
                <button type="button" onClick={() => setMode('signin')} className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)]">
                  {tr('← Volver')}
                </button>
              </form>
            )
          ) : mode === 'signup' && signupSent ? (
            <div className="text-center space-y-3">
              <p className="text-sm">
                {withEmail(tr('Te mandamos un correo a {email}. Abre el enlace ahí para confirmar tu cuenta y poder entrar.', { email: MARK }), email)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">{tr('Si no lo ves, revisa spam o promociones.')}</p>
              <button onClick={() => { setMode('signin'); setSignupSent(false) }} className="text-xs text-[var(--color-light-amber)] hover:underline">
                {tr('← Volver a entrar')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <>
                  <input
                    type="text"
                    placeholder={tr('Tu nombre')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                  />
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)] block mb-1">{tr('Equipo favorito (opcional)')}</label>
                    <div className="flex items-center gap-2">
                      {favoriteTeam && <img src={teamLogoUrl(favoriteTeam)} alt={favoriteTeam} className="w-7 h-7 object-contain shrink-0" />}
                      <select
                        value={favoriteTeam}
                        onChange={(e) => setFavoriteTeam(e.target.value)}
                        className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                      >
                        <option value="">{tr('Sin elegir')}</option>
                        {NFL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
              <input
                type="email"
                placeholder={tr('Correo')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              />
              <input
                type="password"
                placeholder={tr('Contrasena')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              />
              {mode === 'signup' && (
                <label className="flex items-start gap-2 text-xs text-[var(--color-text-muted)] leading-snug cursor-pointer">
                  <input type="checkbox" required className="mt-0.5 accent-[#F2B705]" />
                  <span>
                    {tr('He leído y acepto el {link}.', { link: MARK }).split(MARK).flatMap((part, i) => i === 0 ? [part] : [<a key="pv" href="#privacidad" target="_blank" rel="noopener noreferrer" className="text-[var(--color-light-amber)] underline">{tr('Aviso de privacidad')}</a>, part])}
                  </span>
                </label>
              )}
              {error && <p className="text-[var(--color-scoreboard-red)] text-xs">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 transition disabled:opacity-50"
              >
                {busy ? tr('Un momento...') : mode === 'signin' ? tr('Entrar') : tr('Crear cuenta')}
              </button>
              {mode === 'signin' && (
                <button type="button" onClick={() => setMode('forgot')} className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)]">
                  {tr('¿Olvidaste tu contrasena?')}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
