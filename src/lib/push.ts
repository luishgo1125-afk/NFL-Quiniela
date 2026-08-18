import { supabase } from './supabase'

// Reemplaza con tu Public Key de VAPID (la que generaste con "npx web-push generate-vapid-keys")
const VAPID_PUBLIC_KEY = 'BL84TjXF2N6hGSFij8hF_mgekl6IXXDAHk84jz9OPhylmH4v4WDOOXf4_vBr5yFKmdgnpvPYKARnLOgHStgBZ0I'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getPushSubscriptionStatus(): Promise<'granted' | 'denied' | 'default'> {
  if (!pushSupported()) return 'denied'
  return Notification.permission
}

export async function enablePush(userId: string) {
  if (!pushSupported()) throw new Error('Este navegador no soporta notificaciones push.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('No diste permiso para las notificaciones.')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const json = subscription.toJSON()
  await supabase.from('push_subscriptions').insert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  })
}

export async function disablePush() {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    await subscription.unsubscribe()
  }
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription != null
}
