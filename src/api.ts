import { useQuery } from '@tanstack/react-query'
import type { DistanceFareResult, FareResult } from '../server/fare-types.ts'

export type { DistanceFareResult, FareItem, FareResult } from '../server/fare-types.ts'

export async function fetchEshotFare(line: string, dir: 1 | 2, from: string, to: string, htt: boolean): Promise<DistanceFareResult> {
  const res = await fetch(`/api/fare/eshot?line=${line}&dir=${dir}&from=${from}&to=${to}&htt=${htt ? 1 : 0}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? 'Ücret bilgisi alınamadı')
  return body as DistanceFareResult
}

export async function fetchFare(from: number, to: number, date: string): Promise<FareResult> {
  const res = await fetch(`/api/fare?from=${from}&to=${to}&date=${date}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? 'Ücret bilgisi alınamadı')
  return body as FareResult
}

export function useFare(from: number | null, to: number | null, date: string) {
  return useQuery({
    queryKey: ['fare', from, to, date],
    queryFn: () => fetchFare(from!, to!, date),
    enabled: from !== null && to !== null && from !== to && date !== '',
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
}

export function todayInIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}
