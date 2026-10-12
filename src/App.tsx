import { useEffect, useState } from 'react'
import { todayInIstanbul, useFare } from './api'
import { FarePanel } from './components/FarePanel'
import { NetworkMap } from './components/NetworkMap'
import { SimMap } from './components/sim/SimMap'
import { SimPanel } from './components/sim/SimPanel'
import { loadJourney, saveJourney, type Journey } from './sim/journey'
import { useSimulation } from './sim/useSimulation'
import { useRouteIndex } from './transit/data'

type Tab = 'sim' | 'izban'
const TAB_KEY = 'izmir-ag.tab'

function readTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'izban' ? 'izban' : 'sim'
  } catch {
    return 'sim'
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readTab)

  // İZBAN ücret sekmesi
  const [fromId, setFromId] = useState<number | null>(null)
  const [toId, setToId] = useState<number | null>(null)
  const [date, setDate] = useState(todayInIstanbul)
  const fare = useFare(fromId, toId, date)

  // Yolculuk simülasyonu sekmesi
  const [journey, setJourney] = useState<Journey>(() => loadJourney(todayInIstanbul()))
  useEffect(() => saveJourney(journey), [journey])
  const index = useRouteIndex()
  const sim = useSimulation(journey, index.data?.byId)

  const chooseTab = (t: Tab) => {
    setTab(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* yok say */
    }
  }

  // Haritada tıklama sırası: önce biniş, sonra iniş; ikisi de seçiliyse yeni biniş.
  const handleStationClick = (id: number) => {
    if (fromId === null || toId !== null) {
      setFromId(id)
      setToId(null)
    } else if (id === fromId) {
      setFromId(null)
    } else {
      setToId(id)
    }
  }

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <main className="relative min-h-0 flex-1">
        {tab === 'izban' ? (
          <>
            <NetworkMap fromId={fromId} toId={toId} onStationClick={handleStationClick} />
            <Legend />
          </>
        ) : (
          <SimMap legs={sim.resolved} />
        )}
      </main>
      <aside className="max-h-[60dvh] shrink-0 overflow-y-auto border-t border-[var(--line)] bg-[var(--bg)] md:max-h-none md:w-[440px] md:border-t-0 md:border-l">
        <header className="z-10 md:sticky md:top-0border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 pt-4 backdrop-blur md:px-6 md:pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">İzmir Toplu Ulaşım</p>
          <h1 className="font-display text-3xl font-bold leading-none text-[var(--ink)]">Ücret Haritası</h1>
          <nav className="mt-3 flex gap-4" role="tablist" aria-label="Görünüm">
            {(
              [
                ['sim', 'Yolculuk Simülasyonu'],
                ['izban', 'İZBAN Ücreti'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => chooseTab(id)}
                className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition ${tab === id ? 'border-[var(--izban)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>
        <div className="p-4 md:p-6">
          {tab === 'izban' ? (
            <FarePanel
              fromId={fromId}
              toId={toId}
              date={date}
              onFromChange={setFromId}
              onToChange={setToId}
              onSwap={() => {
                setFromId(toId)
                setToId(fromId)
              }}
              onClear={() => {
                setFromId(null)
                setToId(null)
              }}
              onDateChange={(d) => setDate(d || todayInIstanbul())}
              fare={fare.data}
              isLoading={fare.isLoading}
              error={fare.error}
            />
          ) : (
            <SimPanel
              journey={journey}
              onJourney={setJourney}
              routes={index.data?.routes}
              routesError={index.error}
              resolved={sim.resolved}
              results={sim.results}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

function Legend() {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-[500] flex flex-col gap-1 rounded-lg bg-[var(--bg)]/90 px-3 py-2 text-xs font-semibold text-[var(--ink)] shadow-sm backdrop-blur">
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-5 rounded-full bg-[var(--izban)]" /> İZBAN
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-5 rounded-full bg-[var(--metro)]" /> Metro M1
      </span>
    </div>
  )
}
