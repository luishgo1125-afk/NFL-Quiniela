// Idiomas: el espanol es el texto original en el codigo; el ingles se busca en
// los diccionarios de src/i18n/en/*.ts (clave = el texto en espanol).
export type Lang = 'es' | 'en'

const modules = import.meta.glob('./en/*.ts', { eager: true }) as Record<string, { dict: Record<string, string> }>
const dict: Record<string, string> = {}
Object.values(modules).forEach((m) => Object.assign(dict, m.dict))

const STORAGE_KEY = 'quiniela_lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch { /* sin almacenamiento */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

let current: Lang = detect()

export function getLang(): Lang { return current }
export function hasSavedLang(): boolean {
  try { const s = localStorage.getItem(STORAGE_KEY); return s === 'es' || s === 'en' } catch { return false }
}
export function setLang(l: Lang) {
  current = l
  try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignora */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l
}
// para fechas/numeros: 'es-MX' o 'en-US'
export function localeTag(): string { return current === 'en' ? 'en-US' : 'es-MX' }

const warned = new Set<string>()
// Traduce. `es` es el texto en espanol; admite variables: tr('Te faltan {n}', { n: 3 })
export function tr(es: string, vars?: Record<string, string | number>): string {
  let s = es
  if (current === 'en') {
    const hit = dict[es]
    if (hit !== undefined) s = hit
    else if (import.meta.env.DEV && !warned.has(es)) { warned.add(es); console.warn('[i18n] falta traduccion:', es) }
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''))
  return s
}
