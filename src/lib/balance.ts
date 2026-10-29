import { supabase } from './supabase'
import { localeTag } from '../i18n'

export interface BalanceEntry {
  id: string
  user_id: string
  group_id: string
  amount: number
  kind: 'entry' | 'prize' | 'settlement' | 'payment' | 'adjustment'
  ref_key: string
  note: string | null
  created_at: string
}

export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString(localeTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// movimientos propios del usuario (mas recientes primero)
export async function fetchMyBalanceEntries(userId: string): Promise<BalanceEntry[]> {
  const { data } = await supabase
    .from('balance_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as any[]).map((e) => ({ ...e, amount: Number(e.amount) })) as BalanceEntry[]
}

export function sumEntries(entries: { amount: number }[]): number {
  return Math.round(entries.reduce((a, e) => a + e.amount, 0) * 100) / 100
}
