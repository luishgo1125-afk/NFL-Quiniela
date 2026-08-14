import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

async function ensureProfile(user: User) {
  // Crea el perfil si por alguna razon no existe (ej. la confirmacion de correo
  // interrumpio el insert original al registrarse). No pisa el nombre si ya existe.
  await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        display_name:
          user.user_metadata?.display_name ??
          user.email?.split('@')[0] ??
          'Jugador',
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      setLoading(false);
      if (sessionUser) ensureProfile(sessionUser);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) ensureProfile(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
