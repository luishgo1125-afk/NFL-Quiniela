import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { initTheme } from './lib/theme'
import './index.css'
import App from './App'

initTheme()

// Sin esto, el navegador nunca revisa si hay una version nueva del service
// worker -- se queda con lo cacheado hasta que se fuerce un refresh manual.
// "immediate: true" + registerType: 'autoUpdate' (en vite.config.ts) hacen
// que en cuanto detecte una version nueva, la active y recargue solo, sin
// pedirte confirmacion.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    // el navegador no siempre revisa actualizaciones seguido por su cuenta
    // (sobre todo con la app abierta como PWA sin recargar) -- forzamos una
    // revision cada hora para que no tarde en enterarse de un deploy nuevo
    setInterval(() => registration.update(), 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
