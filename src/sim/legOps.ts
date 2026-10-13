import type { SimulationResult } from '../fare/engine'
import { newLegId, type Journey, type LegDraft } from './journey'

/** Bir senaryonun binişleri üzerinde ekle / güncelle / taşı / sil / temizle işlemleri. */
export function legOps(journey: Journey, onJourney: (j: Journey) => void, onActive: (id: string | null) => void) {
  const setLegs = (legs: LegDraft[]) => onJourney({ ...journey, legs })
  return {
    update: (id: string, patch: Partial<LegDraft>) => setLegs(journey.legs.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    move: (i: number, delta: -1 | 1) => {
      const legs = [...journey.legs]
      ;[legs[i], legs[i + delta]] = [legs[i + delta], legs[i]]
      setLegs(legs)
    },
    add: () => {
      const id = newLegId()
      setLegs([...journey.legs, { id }])
      onActive(id)
    },
    remove: (id: string, activeId: string | null) => {
      setLegs(journey.legs.filter((l) => l.id !== id))
      if (activeId === id) onActive(null)
    },
    /** Onay alarak tüm binişleri siler. */
    clear: () => {
      if (!window.confirm(`Bu senaryodaki ${journey.legs.length} biniş silinsin mi?`)) return
      setLegs([])
      onActive(null)
    },
  }
}

/** Liste başlığı için özet: biniş sayısı, ücretli biniş sayısı, toplam ve aktarma tasarrufu. */
export function legStats(journey: Journey, detail: SimulationResult) {
  return {
    count: journey.legs.length,
    paid: detail.legs.filter((r) => r.status === 'paid' || r.status === 'transfer-partial').length,
    transfers: detail.legs.filter((r) => r.status === 'transfer' || r.status === 'transfer-partial').length,
    total: detail.total,
    saved: detail.saved,
  }
}
