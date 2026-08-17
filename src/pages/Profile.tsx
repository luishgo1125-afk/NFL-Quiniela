import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { NFL_TEAMS } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'
import { IconUser } from '../components/icons'
import type { User } from '@supabase/supabase-js'

export default function Profile({
  user,
  activeGroupName,
  showLeaveGroup,
  onLeaveGroup,
}: {
  user: User
  activeGroupName?: string | null
  showLeaveGroup?: boolean
  onLeaveGroup?: () => void
}) {
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [pwOk, setPwOk] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('display_name, favorite_team').eq('id', user.id).single().then(({ data }) => {
      setName(data?.display_name ?? '')
      setTeam(data?.favorite_team ?? '')
      setLoading(false)
    })
  }, [user.id])

  async function saveProfile() {
    setSavingProfile(true)
    setProfileMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name, favorite_team: team || null })
      .eq('id', user.id)
    setSavingProfile(false)
    setProfileMsg(error ? error.message : 'Guardado.')
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwErr(null)
    if (pw.length < 6) { setPwErr('La contrasena debe tener al menos 6 caracteres'); return }
    if (pw !== pw2) { setPwErr('Las contrasenas no coinciden'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSavingPw(false)
    if (error) { setPwErr(error.message); return }
    setPwOk(true)
    setPw('')
    setPw2('')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-14 h-14 rounded-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center overflow-hidden shrink-0">
          {team ? <img src={teamLogoUrl(team)} alt={team} className="w-full h-full object-contain p-2" /> : <IconUser size={24} className="text-[var(--color-text-muted)]" />}
        </div>
        <div>
          <h1 className="font-display text-3xl font-800 leading-none">{loading ? '...' : (name || user.email?.split('@')[0])}</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{user.email}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">Mis datos</h2>
          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Cargando...</p>
          ) : (
            <>
              <div>
                <label className="text-xs text-[var(--color-text-muted)]">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)]">Equipo favorito</label>
                <div className="flex items-center gap-2 mt-1">
                  {team && <img src={teamLogoUrl(team)} alt={team} className="w-8 h-8 object-contain shrink-0" />}
                  <select
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                  >
                    <option value="">Sin elegir</option>
                    {NFL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {profileMsg && <p className="text-xs text-[var(--color-turf-green)]">{profileMsg}</p>}
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50"
              >
                {savingProfile ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>

        <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">Cambiar contrasena</h2>
          {pwOk ? (
            <p className="text-sm text-[var(--color-turf-green)]">Contrasena actualizada.</p>
          ) : (
            <form onSubmit={savePassword} className="space-y-3">
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
              {pwErr && <p className="text-xs text-[var(--color-scoreboard-red)]">{pwErr}</p>}
              <button
                type="submit"
                disabled={savingPw}
                className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50"
              >
                {savingPw ? 'Guardando...' : 'Actualizar contrasena'}
              </button>
            </form>
          )}
        </div>

        {showLeaveGroup && (
          <button
            onClick={onLeaveGroup}
            className="w-full text-sm font-semibold rounded-md py-2.5 border border-[var(--color-scoreboard-red)]/40 text-[var(--color-scoreboard-red)] hover:bg-[var(--color-scoreboard-red)]/10 transition"
          >
            Salir de {activeGroupName ? `"${activeGroupName}"` : 'esta liga'}
          </button>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full text-sm font-semibold rounded-md py-2.5 bg-[var(--color-scoreboard-red)] text-white hover:brightness-110 transition"
        >
          Cerrar sesion
        </button>
      </div>
    </div>
  )
}
