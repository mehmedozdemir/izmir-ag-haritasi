import { useCallback, useMemo, useState } from 'react'
import { todayInIstanbul, useFare } from './api'
import { FarePanel } from './components/FarePanel'
import { NetworkMap } from './components/NetworkMap'
import type { LegLayout } from './components/sim/LegList'
import type { ScenarioEditing } from './components/sim/ScenarioBar'
import { SimMap, type FitPadding } from './components/sim/SimMap'
import { SimPanel } from './components/sim/SimPanel'
import { SimWorkspace } from './components/sim/SimWorkspace'
import {
  createScenario,
  defaultScenarioInput,
  duplicateScenario,
  emptyJourney,
  exampleScenario,
  useScenarioStore,
} from './sim/scenarios'
import { useSimulation } from './sim/useSimulation'
import { useRouteIndex } from './transit/data'
import { useMediaQuery } from './useMediaQuery'

type Tab = 'sim' | 'izban'
const TAB_KEY = 'izmir-ag.tab'
const LAYOUT_KEY = 'izmir-ag.legLayout'

type MapLayout = Exclude<LegLayout, 'sidebar'>
const MAP_LAYOUTS: { id: MapLayout; label: string; icon: string }[] = [
  { id: 'top-left', label: 'Sol üst', icon: '◰' },
  { id: 'top-right', label: 'Sağ üst', icon: '◳' },
  { id: 'bottom', label: 'Alt', icon: '⬓' },
]

// Kartların haritada kapladığı kenar; yakınlaştırmada bu alan boş bırakılır.
const FIT_PADDING: Record<LegLayout, FitPadding> = {
  sidebar: { topLeft: [50, 50], bottomRight: [50, 50] },
  'top-left': { topLeft: [400, 110], bottomRight: [50, 50] },
  'top-right': { topLeft: [50, 110], bottomRight: [400, 50] },
  bottom: { topLeft: [50, 60], bottomRight: [50, 300] },
}

function readLayout(): MapLayout {
  try {
    const v = localStorage.getItem(LAYOUT_KEY)
    return MAP_LAYOUTS.some((l) => l.id === v) ? (v as MapLayout) : 'top-left'
  } catch {
    return 'top-left'
  }
}

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

  // Yolculuk simülasyonu sekmesi: senaryolar ve seçili senaryonun binişleri
  const scenarios = useScenarioStore()
  const active = scenarios.active
  const placeholder = useMemo(() => emptyJourney(todayInIstanbul()), [])
  const index = useRouteIndex()
  const sim = useSimulation(active ?? placeholder, index.data?.byId)
  const [activeLegId, setActiveLegId] = useState<string | null>(null)
  const onActive = useCallback((id: string | null) => setActiveLegId(id), [])
  const [editing, setEditing] = useState<ScenarioEditing>(null)
  const onEditing = useCallback((e: ScenarioEditing) => setEditing(e), [])

  // Geniş masaüstünde binişler harita üzerinde yüzen kartlar olarak gösterilir.
  const wide = useMediaQuery('(min-width: 1280px)')
  const [mapLayout, setMapLayout] = useState<MapLayout>(readLayout)
  const legLayout: LegLayout = wide ? mapLayout : 'sidebar'
  const chooseLayout = (l: MapLayout) => {
    setMapLayout(l)
    try {
      localStorage.setItem(LAYOUT_KEY, l)
    } catch {
      /* yok say */
    }
  }

  const workspace = (layout: LegLayout) => (
    <SimWorkspace
      layout={layout}
      scenarios={scenarios.store.scenarios}
      active={active}
      onSelect={(id) => {
        scenarios.select(id)
        setActiveLegId(null)
      }}
      onUpdate={scenarios.update}
      onCreate={(input) => {
        scenarios.add(createScenario(input))
        setActiveLegId(null)
      }}
      onDuplicate={(s) => scenarios.add(duplicateScenario(s))}
      onDelete={(s) => {
        scenarios.remove(s.id)
        setActiveLegId(null)
      }}
      onLoadExample={() => scenarios.add(exampleScenario(todayInIstanbul()))}
      newInput={() => defaultScenarioInput(todayInIstanbul(), scenarios.store.scenarios.length + 1)}
      editing={editing}
      onEditing={onEditing}
      routes={index.data?.routes}
      routesById={index.data?.byId}
      routesError={index.error}
      resolved={sim.resolved}
      detail={sim.results[(active ?? placeholder).detailCard]}
      activeLegId={activeLegId}
      onActiveLeg={onActive}
      switcher={<LayoutSwitcher value={mapLayout} onChange={chooseLayout} />}
    />
  )

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
          <>
            <SimMap legs={sim.resolved} activeId={activeLegId} onSelect={onActive} fitPadding={FIT_PADDING[legLayout]} />
            {legLayout !== 'sidebar' && (
              <>
                {workspace(legLayout)}
                {legLayout === 'bottom' && (
                  <div className="absolute top-3 left-1/2 z-[650] -translate-x-1/2">
                    <LayoutSwitcher value={mapLayout} onChange={chooseLayout} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
      <aside className="max-h-[60dvh] shrink-0 overflow-y-auto border-t border-[var(--line)] bg-[var(--bg)] md:max-h-none md:w-[440px] md:border-t-0 md:border-l">
        <header className="z-10 md:sticky md:top-0 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 pt-4 backdrop-blur md:px-6 md:pt-5">
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
              scenario={active}
              scenarioCount={scenarios.store.scenarios.length}
              onCardChange={(card) => active && scenarios.update({ ...active, detailCard: card })}
              onClearAll={() => {
                scenarios.clearAll()
                setActiveLegId(null)
                setEditing(null)
              }}
              resolved={sim.resolved}
              results={sim.results}
              workspace={legLayout === 'sidebar' ? workspace('sidebar') : null}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

function LayoutSwitcher({ value, onChange }: { value: MapLayout; onChange: (l: MapLayout) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Biniş kartlarının yeri"
      className="flex items-center gap-0.5 rounded-full bg-[var(--bg)]/90 p-1 text-xs font-semibold whitespace-nowrap shadow-sm backdrop-blur"
    >
      {/* Yer kaplamasın diye yalnızca simge; adı ipucu ve ekran okuyucu etiketinde. */}
      {MAP_LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          aria-label={`Kartlar: ${l.label}`}
          title={`Kartlar: ${l.label}`}
          onClick={() => onChange(l.id)}
          className={`grid h-7 w-7 place-items-center rounded-full transition ${value === l.id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--ink)] hover:bg-[var(--track)]'}`}
        >
          <span aria-hidden className="text-base leading-none">{l.icon}</span>
        </button>
      ))}
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
