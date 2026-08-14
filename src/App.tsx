import { useEffect, useState } from 'react'
import { useAuth } from './lib/useAuth'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Groups from './pages/Groups'
import GroupDashboard from './pages/GroupDashboard'
import ProfileMenu from './components/ProfileMenu'
import type { Group } from './lib/types'

function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (pw.length < 6) { setErr('La contrasena debe tener al menos 6 caracteres'); return }
    if (pw !== pw2) { setErr('Las contrasenas no coinciden'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onDone()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-800 text-center mb-6">Nueva contrasena</h1>
        <form onSubmit={save} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-6 space-y-3">
          <input
            type="password"
            placeholder="Nueva contrasena"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
          />
          <input
            type="password"
            placeholder="Confirmar contrasena"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
          />
          {err && <p className="text-[var(--color-scoreboard-red)] text-xs">{err}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar y entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // si cambia el usuario logueado (cerrar sesion y entrar con otra cuenta sin
  // recargar la pagina), regresa a la lista de quinielas en vez de dejar
  // abierta la liga de la sesion anterior
  useEffect(() => {
    setActiveGroup(null)
  }, [user?.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono-score text-[var(--color-light-amber)] text-sm animate-pulse">CARGANDO...</span>
      </div>
    )
  }

  if (recovery) return <ResetPasswordScreen onDone={() => setRecovery(false)} />

  if (!user) return <Login />

  return (
    <div>
      <header className="border-b border-[var(--color-field-line)] px-4 py-3 flex items-center justify-between">
        <span className="font-display text-lg font-700">QUINIELA<span className="text-[var(--color-light-amber)]">.</span></span>
        <ProfileMenu user={user} />
      </header>

      {activeGroup ? (
        <GroupDashboard group={activeGroup} user={user} onBack={() => setActiveGroup(null)} />
      ) : (
        <Groups user={user} onSelect={setActiveGroup} />
      )}
    </div>
  )
}
