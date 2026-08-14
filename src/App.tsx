import { useState } from 'react'
import { useAuth } from './lib/useAuth'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Groups from './pages/Groups'
import GroupDashboard from './pages/GroupDashboard'
import type { Group } from './lib/types'

export default function App() {
  const { user, loading } = useAuth()
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono-score text-[var(--color-light-amber)] text-sm animate-pulse">CARGANDO...</span>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div>
      <header className="border-b border-[var(--color-field-line)] px-4 py-3 flex items-center justify-between">
        <span className="font-display text-lg font-700">QUINIELA<span className="text-[var(--color-light-amber)]">.</span></span>
        <button onClick={() => supabase.auth.signOut()} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-scoreboard-red)]">
          Cerrar sesion
        </button>
      </header>

      {activeGroup ? (
        <GroupDashboard group={activeGroup} user={user} onBack={() => setActiveGroup(null)} />
      ) : (
        <Groups user={user} onSelect={setActiveGroup} />
      )}
    </div>
  )
}
