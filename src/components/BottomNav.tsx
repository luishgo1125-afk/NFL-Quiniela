import { IconHome, IconGlobe, IconPlusCircle, IconBell, IconUser } from './icons'

export type BottomTab = 'quinielas' | 'ranking' | 'notificaciones' | 'perfil'

export default function BottomNav({
  active,
  onChange,
  onCreate,
  hasNotifications,
  canCreate,
}: {
  active: BottomTab
  onChange: (tab: BottomTab) => void
  onCreate: () => void
  hasNotifications: boolean
  canCreate: boolean
}) {
  const items: { key: BottomTab | 'crear'; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    { key: 'quinielas', label: 'Quinielas', icon: (a) => <IconHome size={20} className={a ? 'text-[var(--color-light-amber)]' : ''} /> },
    { key: 'ranking', label: 'Ranking global', icon: (a) => <IconGlobe size={20} className={a ? 'text-[var(--color-light-amber)]' : ''} /> },
    { key: 'crear', label: canCreate ? 'Crear quiniela' : 'Unirse a quiniela', icon: () => <IconPlusCircle size={22} /> },
    { key: 'notificaciones', label: 'Notificaciones', icon: (a) => <IconBell size={20} className={a ? 'text-[var(--color-light-amber)]' : ''} /> },
    { key: 'perfil', label: 'Perfil', icon: (a) => <IconUser size={20} className={a ? 'text-[var(--color-light-amber)]' : ''} /> },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t z-30"
      style={{ background: 'var(--color-field-surface)', borderColor: 'var(--color-field-line)' }}
    >
      <div className="max-w-2xl mx-auto grid grid-cols-5">
        {items.map((item) => {
          const isActive = item.key !== 'crear' && item.key === active
          const isCreate = item.key === 'crear'
          return (
            <button
              key={item.key}
              onClick={() => (isCreate ? onCreate() : onChange(item.key as BottomTab))}
              className="flex flex-col items-center justify-center gap-1 py-2.5 relative"
            >
              <span
                className="relative flex items-center justify-center"
                style={{ color: isCreate ? 'var(--color-light-amber)' : isActive ? 'var(--color-light-amber)' : 'var(--color-text-muted)' }}
              >
                {item.icon(isActive)}
                {item.key === 'notificaciones' && hasNotifications && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[var(--color-light-amber)]" />
                )}
              </span>
              <span
                className="text-[9px] font-medium leading-none text-center px-0.5"
                style={{ color: isCreate ? 'var(--color-light-amber)' : isActive ? 'var(--color-light-amber)' : 'var(--color-text-muted)' }}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
