import { createContext, useContext } from 'react'
import type { Lang } from './index'
import { supabase } from '../lib/supabase'

export const LangContext = createContext<{ lang: Lang; setLanguage: (l: Lang) => void }>({ lang: 'es', setLanguage: () => {} })
export const useLang = () => useContext(LangContext)

// guarda el idioma elegido en el perfil del usuario (para recordarlo en otros dispositivos)
export async function saveLanguage(userId: string, l: Lang) {
  const { error } = await supabase.from('profiles').update({ language: l }).eq('id', userId)
  if (error) console.error('No se pudo guardar el idioma', error)
}
