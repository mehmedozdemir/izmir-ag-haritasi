import raw from './data/network.json'

export type LatLng = [number, number]

export type Line = {
  id: string
  name: string
  kind: 'izban' | 'metro'
  color: string
  coords: LatLng[]
}

export type Station = {
  id: string
  line: string
  order: number
  name: string
  lat: number
  lng: number
  shapeIndex: number
  /** tarife.izmirimkart.com.tr istasyon ID'si (yalnızca İZBAN) */
  tarifeId?: number
}

export const lines = raw.lines as Line[]
export const stations = raw.stations as Station[]

export const izbanStations = stations.filter((s) => s.tarifeId !== undefined)

export const stationByTarifeId = new Map(izbanStations.map((s) => [s.tarifeId!, s]))

/** İki İZBAN durağı arasındaki hat parçası (harita vurgusu için). */
export function izbanSegment(fromId: number, toId: number): LatLng[] {
  const a = stationByTarifeId.get(fromId)
  const b = stationByTarifeId.get(toId)
  const line = lines.find((l) => l.id === 'izban')
  if (!a || !b || !line) return []
  const [start, end] = a.shapeIndex <= b.shapeIndex ? [a.shapeIndex, b.shapeIndex] : [b.shapeIndex, a.shapeIndex]
  return line.coords.slice(start, end + 1)
}

/** İki İZBAN durağı arasındaki durak sayısı. */
export function stopsBetween(fromId: number, toId: number): number {
  const a = stationByTarifeId.get(fromId)
  const b = stationByTarifeId.get(toId)
  return a && b ? Math.abs(a.order - b.order) : 0
}

/** Metro ile aktarma yapılabilen İZBAN durakları. */
export const transferStations = new Set(['Halkapınar', 'Hilal'])
