// Yolculuk taslağı: kullanıcının sırayla eklediği binişler ve genel ayarlar.
import { DEFAULT_SETTINGS, type FareSettings } from '../fare/engine'
import type { CardType } from '../fare/tariffs'

export type LegDraft = {
  id: string
  routeId?: string
  dirId?: string
  fromStopId?: string
  toStopId?: string
  /** Elle girilen biniş saati (HH:MM); yoksa otomatik hesaplanır. */
  boardOverride?: string
}

export type Journey = {
  date: string
  startTime: string
  /** Bir inişten sonraki binişe kadar varsayılan aktarma/yürüme süresi (dk). */
  transferBufferMin: number
  /** Boş bırakılırsa bakiye takibi yapılmaz. */
  startBalance: number | null
  settings: FareSettings
  detailCard: CardType
  legs: LegDraft[]
}

export const newLegId = () => Math.random().toString(36).slice(2, 10)

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export const fmtMin = (min: number) => {
  const m = Math.round(min)
  const day = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}${day > 0 ? ` (+${day} gün)` : ''}`
}

export function defaultJourney(today: string): Journey {
  return {
    date: today,
    startTime: '08:30',
    transferBufferMin: 5,
    startBalance: null,
    settings: DEFAULT_SETTINGS,
    detailCard: 'tam',
    legs: [{ id: newLegId() }],
  }
}

/** Karşıyaka'dan İZBAN → Halkapınar'dan Metro → Konak'tan vapurla Karşıyaka'ya dönüş. */
export function exampleLegs(): LegDraft[] {
  return [
    { id: newLegId(), routeId: 'izban', dirId: '0', fromStopId: 'izban:15', toStopId: 'izban:21' },
    { id: newLegId(), routeId: 'metro-m1', dirId: '0', fromStopId: 'metro:6', toStopId: 'metro:2' },
    { id: newLegId(), routeId: 'izdeniz', dirId: '0', fromStopId: 'ferry:konak', toStopId: 'ferry:karsiyaka' },
  ]
}

const STORAGE_KEY = 'izmir-ag.journey.v1'

export function loadJourney(today: string): Journey {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const j = JSON.parse(raw) as Journey
      // Ayarlara sonradan eklenen alanlar için varsayılanlarla birleştir; tarih her açılışta bugüne döner.
      return { ...defaultJourney(today), ...j, date: today, settings: { ...DEFAULT_SETTINGS, ...j.settings } }
    }
  } catch {
    /* depolama yoksa varsayılan */
  }
  return defaultJourney(today)
}

export function saveJourney(j: Journey) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(j))
  } catch {
    /* depolama kapalıysa taslak yalnızca bu oturumda kalır */
  }
}
