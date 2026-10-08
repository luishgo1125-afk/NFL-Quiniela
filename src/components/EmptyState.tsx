import type { ReactNode } from 'react'

export default function EmptyState({ icon, title, text, actionLabel, onAction }: {
  icon: ReactNode
  title: string
  text: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="empty-state">
      <span className="ico">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="home-btn amber">{actionLabel}</button>
      )}
    </div>
  )
}
