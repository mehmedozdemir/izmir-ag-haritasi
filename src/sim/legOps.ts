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

/** Liste başlığındaki kısa özet: "8 biniş · 3 ücretli · 51,50 TL". */
export function legSummary(journey: Journey, detail: SimulationResult): string {
  const n = journey.legs.length
  if (n === 0) return 'Henüz biniş yok'
  const paid = detail.legs.filter((r) => r.status === 'paid' || r.status === 'transfer-partial').length
  const total =
    detail.total === null
      ? '…'
      : `${detail.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
  return `${n} biniş · ${paid} ücretli · ${total}`
}
