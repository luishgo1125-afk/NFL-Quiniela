# Quiniela NFL

App de predicciones de la NFL para grupos de amigos/familia. Cada quien predice el
marcador exacto de cada partido; se otorgan **1 punto** por acertar el equipo ganador
y **3 puntos** si aciertas el marcador exacto.

## Stack
- React + Vite + TypeScript
- Tailwind CSS v4
- Supabase (Auth + Postgres + RLS)

## 1. Crear el proyecto en Supabase
1. Ve a https://supabase.com y crea un proyecto nuevo (gratis).
2. En **SQL Editor**, pega y ejecuta el contenido de `supabase/schema.sql`.
3. En **Project Settings → API**, copia la `Project URL` y la `anon public key`.

## 2. Configurar variables de entorno
```
cp .env.example .env
```
Y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores del paso anterior.

## 3. Instalar y correr localmente
```
npm install
npm run dev
```

## 4. Desplegar (por ejemplo en Vercel)
1. Sube este proyecto a un repo de GitHub.
2. Importa el repo en Vercel.
3. Agrega las mismas variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en la configuración del proyecto de Vercel.
4. Deploy.

## Cómo funciona
- **Crear cuenta / entrar**: cada persona se registra con correo y contraseña.
- **Grupos**: cualquiera puede crear un grupo (queda como administrador) o unirse
  con el código de invitación de 6 caracteres que genera el grupo.
- **Partidos automáticos**: en la pestaña "Administrar", el botón "Sincronizar con la
  NFL" trae los partidos, horarios y marcadores directo del calendario oficial (vía la
  API pública de ESPN, sin necesidad de llave ni pago). Se puede correr varias veces:
  agrega partidos nuevos y actualiza marcadores finales sin duplicar nada. También se
  puede agregar un partido a mano si hace falta.
- **Predicciones**: los miembros ingresan su marcador predicho antes del kickoff; una vez
  que inicia el partido, la predicción se bloquea automáticamente.
- **Resultados y puntos**: al sincronizar (o al capturar el marcador manualmente y
  presionar "Finalizar"), los puntos se calculan automáticamente para todos
  (función `calculate_points_for_game` en la base de datos).
- **Tabla**: suma de puntos de todos los miembros del grupo, ordenada de mayor a menor.

## Sobre la sincronización con la NFL
Usa `site.api.espn.com`, una API pública **no oficial** de ESPN. No requiere API key ni
registro, pero ESPN puede cambiarla o quitarla sin aviso — por eso siempre queda también
la opción de capturar partidos a mano como respaldo.

## Posibles mejoras futuras
- Sincronización automática programada (sin que el admin tenga que presionar el botón).
- Notificaciones antes de que cierre cada semana.
- Editar/eliminar miembros del grupo.
- Reglas de puntuación configurables por grupo.
