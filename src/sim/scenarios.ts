// Ücret senaryoları: her biri kendi tarih, saat, kart tipi, bakiye ve binişlerine sahip adlandırılmış bir yolculuk.
// Tarayıcıda (localStorage) saklanır.
import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../fare/engine'
import type { CardType } from '../fare/tariffs'
import { exampleLegs, newLegId, type Journey } from './journey'

export type Scenario = Journey & { id: string; name: string; createdAt: string }

export type ScenarioStore = { scenarios: Scenario[]; activeId: string | null }

/** Senaryo oluşturma/düzenleme formundaki alanlar. */
export type ScenarioInput = {
  name: string
  date: string
  startTime: string
  card: CardType
  startBalance: number | null
  transferBufferMin: number
  izbanTransfer: boolean
}

const STORAGE_KEY = 'izmir-ag.scenarios.v1'

export function defaultScenarioInput(today: string, index: number): ScenarioInput {
  return {
    name: `Senaryo ${index}`,
    date: today,
    startTime: '08:30',
    card: 'tam',
    startBalance: null,
    transferBufferMin: 5,
    izbanTransfer: DEFAULT_SETTINGS.izbanTransfer,
  }
}

export function scenarioToInput(s: Scenario): ScenarioInput {
  return {
    name: s.name,
    date: s.date,
    startTime: s.startTime,
    card: s.detailCard,
    startBalance: s.startBalance,
    transferBufferMin: s.transferBufferMin,
    izbanTransfer: s.settings.izbanTransfer,
  }
}

export function applyInput(s: Scenario, input: ScenarioInput): Scenario {
  return {
    ...s,
    name: input.name,
    date: input.date,
    startTime: input.startTime,
    detailCard: input.card,
    startBalance: input.startBalance,
    transferBufferMin: input.transferBufferMin,
    settings: { ...s.settings, izbanTransfer: input.izbanTransfer },
  }
}

export function createScenario(input: ScenarioInput): Scenario {
  const base: Scenario = {
    id: newLegId(),
    name: input.name,
    createdAt: new Date().toISOString(),
    date: input.date,
    startTime: input.startTime,
    transferBufferMin: input.transferBufferMin,
    startBalance: input.startBalance,
    settings: DEFAULT_SETTINGS,
    detailCard: input.card,
    legs: [],
  }
  return applyInput(base, { ...input, name: input.name.trim() || 'Adsız senaryo' })
}

export const scenarioName = (s: Scenario) => s.name.trim() || 'Adsız senaryo'

export function duplicateScenario(s: Scenario): Scenario {
  return {
    ...s,
    id: newLegId(),
    name: `${s.name} (kopya)`,
    createdAt: new Date().toISOString(),
    legs: s.legs.map((l) => ({ ...l, id: newLegId() })),
  }
}

/** Karşıyaka'dan İZBAN → Halkapınar'dan Metro → Konak'tan vapurla Karşıyaka'ya dönüş. */
export function exampleScenario(today: string): Scenario {
  return { ...createScenario({ ...defaultScenarioInput(today, 1), name: 'Örnek: İZBAN + Metro + Vapur' }), legs: exampleLegs() }
}

/** Boş senaryo durumunda simülasyon kancalarına verilecek yer tutucu. */
export function emptyJourney(today: string): Journey {
  return { ...createScenario(defaultScenarioInput(today, 0)), legs: [] }
}

function load(): ScenarioStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const store = JSON.parse(raw) as ScenarioStore
      // Sonradan eklenen ayar alanları için varsayılanlarla birleştir.
      const scenarios = store.scenarios.map((s) => ({ ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } }))
      const activeId = scenarios.some((s) => s.id === store.activeId) ? store.activeId : (scenarios[0]?.id ?? null)
      return { scenarios, activeId }
    }
  } catch {
    /* depolama yoksa ya da bozuksa boş başla */
  }
  return { scenarios: [], activeId: null }
}

/** Senaryoları localStorage ile eşitleyen durum kancası. */
export function useScenarioStore() {
  const [store, setStore] = useState<ScenarioStore>(load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      /* depolama kapalıysa senaryolar yalnızca bu oturumda kalır */
    }
  }, [store])

  const active = store.scenarios.find((s) => s.id === store.activeId)

  const update = (s: Scenario) => setStore((st) => ({ ...st, scenarios: st.scenarios.map((x) => (x.id === s.id ? s : x)) }))
  const add = (s: Scenario) => setStore((st) => ({ scenarios: [...st.scenarios, s], activeId: s.id }))
  const select = (id: string) => setStore((st) => ({ ...st, activeId: id }))
  const remove = (id: string) =>
    setStore((st) => {
      const idx = st.scenarios.findIndex((s) => s.id === id)
      const scenarios = st.scenarios.filter((s) => s.id !== id)
      const activeId = st.activeId === id ? (scenarios[Math.min(idx, scenarios.length - 1)]?.id ?? null) : st.activeId
      return { scenarios, activeId }
    })
  const clearAll = () => setStore({ scenarios: [], activeId: null })

  return { store, active, update, add, select, remove, clearAll }
}
