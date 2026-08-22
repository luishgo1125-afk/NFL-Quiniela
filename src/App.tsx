import { useEffect, useState } from 'react'
import { useAuth } from './lib/useAuth'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import QuinielasList from './pages/QuinielasList'
import GlobalRanking from './pages/GlobalRanking'
import GroupDashboard from './pages/GroupDashboard'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import BottomNav, { type BottomTab } from './components/BottomNav'
import NewGroupModal, { SUPER_ADMIN_ID } from './components/NewGroupModal'
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
  const [bottomTab, setBottomTab] = useState<BottomTab>('quinielas')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (!user) return
    async function checkUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .is('read_at', null)
      setHasUnread((count ?? 0) > 0)
    }
    checkUnread()
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => checkUnread())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // si cambia el usuario logueado (cerrar sesion y entrar con otra cuenta sin
  // recargar la pagina), regresa al inicio en vez de dejar abierta la liga
  // de la sesion anterior
  useEffect(() => {
    setActiveGroup(null)
    setBottomTab('quinielas')
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

  const activeGroupIsAdmin = activeGroup ? activeGroup.created_by === user.id : false
  const canCreate = user.id === SUPER_ADMIN_ID

  async function leaveActiveGroup() {
    if (!activeGroup) return
    if (!confirm(`¿Seguro que quieres salir de "${activeGroup.name}"? Perderas acceso a esta liga.`)) return
    const { error } = await supabase.rpc('leave_group', { p_group_id: activeGroup.id })
    if (error) { alert(error.message); return }
    setActiveGroup(null)
    setBottomTab('quinielas')
  }

  function selectGroup(g: Group) {
    setActiveGroup(g)
    setBottomTab('quinielas')
  }

  function handleBottomTabChange(tab: BottomTab) {
    if (tab === 'quinielas' && bottomTab === 'quinielas' && activeGroup) {
      setActiveGroup(null)
      return
    }
    setBottomTab(tab)
  }

  return (
    <div className="pb-16">
      <header className="sticky top-0 z-40 border-b border-[var(--color-field-line)] px-4 py-2.5 flex items-center" style={{ background: 'linear-gradient(180deg, rgba(242,183,5,0.05), var(--color-field-night)), var(--color-field-night)' }}>
        <img src="/logo.png" alt="Quiniela" className="h-10 w-auto" />
      </header>

      {bottomTab === 'ranking' && <GlobalRanking user={user} />}

      {bottomTab === 'quinielas' && (
        activeGroup ? (
          <GroupDashboard
            group={activeGroup}
            user={user}
            onBack={() => { setActiveGroup(null); setBottomTab('quinielas') }}
            onGroupChange={setActiveGroup}
          />
        ) : (
          <QuinielasList user={user} onSelect={selectGroup} />
        )
      )}

      {bottomTab === 'notificaciones' && <Notifications user={user} />}

      {bottomTab === 'perfil' && (
        <Profile
          user={user}
          activeGroupName={activeGroup?.name ?? null}
          showLeaveGroup={activeGroup != null && !activeGroupIsAdmin}
          onLeaveGroup={leaveActiveGroup}
        />
      )}

      <BottomNav
        active={bottomTab}
        onChange={handleBottomTabChange}
        onCreate={() => setShowCreateModal(true)}
        hasNotifications={hasUnread}
        canCreate={canCreate}
      />

      {showCreateModal && (
        <NewGroupModal
          canCreate={canCreate}
          onClose={() => setShowCreateModal(false)}
          onDone={() => { setShowCreateModal(false); setBottomTab('quinielas') }}
        />
      )}
    </div>
  )
}
