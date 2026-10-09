import { useState } from 'react'
import type { Lang } from '../i18n'

// Se muestra una sola vez, la primera vez que alguien inicia sesion
export default function LanguagePrompt({ initial, onPick }: { initial: Lang; onPick: (l: Lang) => Promise<void> | void }) {
  const [sel, setSel] = useState<Lang>(initial)
  const [busy, setBusy] = useState(false)
  const opts: { id: Lang; label: string; sub: string }[] = [
    { id: 'es', label: 'Español', sub: 'Continuar en español' },
    { id: 'en', label: 'English', sub: 'Continue in English' },
  ]
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-field-line)] bg-[var(--color-field-surface)] p-6">
        <h2 className="font-display text-3xl font-800 uppercase leading-none">Idioma · Language</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">Elige tu idioma. Podrás cambiarlo después en tu perfil. / Choose your language. You can change it later in your profile.</p>
        <div className="mt-5 space-y-2">
          {opts.map((o) => (
            <button
              key={o.id}
              onClick={() => setSel(o.id)}
              className={`w-full text-left rounded-lg border px-4 py-3 transition ${sel === o.id ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.08)]' : 'border-[var(--color-field-line)] hover:border-[var(--color-text-muted)]'}`}
            >
              <span className={`block text-sm font-semibold ${sel === o.id ? 'text-[var(--color-light-amber)]' : ''}`}>{o.label}</span>
              <span className="block text-xs text-[var(--color-text-muted)]">{o.sub}</span>
            </button>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); await onPick(sel); setBusy(false) }}
          className="home-btn amber w-full mt-5 disabled:opacity-50"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {sel === 'en' ? 'Continue' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
