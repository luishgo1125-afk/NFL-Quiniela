import type { ReactNode } from 'react'

interface StatusPillProps {
  label: string
  variant: 'amber' | 'green' | 'red' | 'muted'
  pulse?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<StatusPillProps['variant'], { bg: string; text: string }> = {
  amber: { bg: 'rgba(242,183,5,0.15)', text: 'var(--color-light-amber)' },
  green: { bg: 'rgba(61,139,95,0.18)', text: '#3D8B5F' },
  red: { bg: 'rgba(228,70,43,0.15)', text: 'var(--color-scoreboard-red)' },
  muted: { bg: 'rgba(138,148,163,0.15)', text: 'var(--color-text-muted)' },
}

export default function StatusPill({ label, variant, pulse, icon }: StatusPillProps) {
  const style = VARIANTS[variant]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: style.bg, color: style.text }}
    >
      {pulse && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: style.text }} />}
      {icon}
      {label}
    </span>
  )
}
