import { useQuery } from '@tanstack/react-query'
import { tariffFor, type Mode, type TariffCode } from '../fare/tariffs'

export type Stop = { id: string; code: string; name: string; lat: number; lng: number; t: number }
export type Direction = { id: string; name: string; stops: Stop[]; shape: [number, number][] }

export type RouteSummary = {
  id: string
  mode: Mode
  ref: string
  name: string
  color: string
  dirs: { id: string; name: string }[]
  /** Vapur: herhangi iki iskele arasında yolculuk. */
  anyOrder?: boolean
  speedKmh?: number
}

export type RouteDetail = { id: string; dirs: Direction[] }

export type RouteInfo = RouteSummary & { tariff: TariffCode }

type TransitIndex = { generatedAt: string; sources: string[]; routes: RouteSummary[] }

export const MODE_META: Record<Mode, { label: string; color: string }> = {
  bus: { label: 'Otobüs', color: '#0f766e' },
  metro: { label: 'Metro', color: '#1e5aa8' },
  tram: { label: 'Tramvay', color: '#ad1457' },
  izban: { label: 'İZBAN', color: '#d7262e' },
  ferry: { label: 'Vapur', color: '#0369a1' },
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} yüklenemedi (${res.status})`)
  return res.json() as Promise<T>
}

export function useRouteIndex() {
  return useQuery({
    queryKey: ['transit-index'],
    queryFn: async () => {
      const idx = await getJson<TransitIndex>('/data/transit/index.json')
      const routes: RouteInfo[] = idx.routes.map((r) => ({ ...r, tariff: tariffFor(r.mode, r.ref) }))
      return { ...idx, routes, byId: new Map(routes.map((r) => [r.id, r])) }
    },
    staleTime: Infinity,
  })
}

export const routeDetailQuery = (id: string) => ({
  queryKey: ['transit-route', id],
  queryFn: () => getJson<RouteDetail>(`/data/transit/routes/${encodeURIComponent(id)}.json`),
  staleTime: Infinity,
})

export function useRouteDetail(id: string | undefined) {
  return useQuery({ ...routeDetailQuery(id ?? ''), enabled: !!id })
}

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Güzergah çizgisinin iki durak arasındaki parçası (durakların çizgiye en yakın noktalarına göre). */
export function shapeBetween(dir: Direction, from: Stop, to: Stop): [number, number][] {
  if (dir.shape.length < 2) return [[from.lat, from.lng], [to.lat, to.lng]]
  const nearest = (s: Stop, startAt = 0) => {
    let best = startAt
    let bestD = Infinity
    for (let i = startAt; i < dir.shape.length; i++) {
      const [y, x] = dir.shape[i]
      const d = (y - s.lat) ** 2 + (x - s.lng) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }
  const a = nearest(from)
  const b = nearest(to, a)
  return [[from.lat, from.lng], ...dir.shape.slice(a, b + 1), [to.lat, to.lng]]
}
