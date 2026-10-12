import { useCallback, useMemo, useState } from 'react'
import { todayInIstanbul, useFare } from './api'
import { FarePanel } from './components/FarePanel'
import { NetworkMap } from './components/NetworkMap'
import type { LegLayout } from './components/sim/LegList'
import type { ScenarioEditing } from './components/sim/ScenarioBar'
import { SimMap, type FitPadding } from './components/sim/SimMap'
import { SimPanel } from './components/sim/SimPanel'
import { SimWorkspace, type BoardView, type WorkspaceLayout } from './components/sim/SimWorkspace'
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
import { SettingsMenu } from './components/SettingsMenu'
import { useCardScale } from './sim/cardScale'

type Tab = 'sim' | 'izban'
const TAB_KEY = 'izmir-ag.tab'
const LAYOUT_KEY = 'izmir-ag.legLayout'
const MAP_KEY = 'izmir-ag.mapOn'
const BOARD_VIEW_KEY = 'izmir-ag.boardView'
const PANEL_KEY = 'izmir-ag.panelOpen'

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v as T) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* depolama kapalıysa tercih yalnızca bu oturumda kalır */
  }
}

type MapLayout = Exclude<LegLayout, 'sidebar'>
const MAP_LAYOUTS: { id: MapLayout; label: string; icon: string }[] = [
  { id: 'top-left', label: 'Sol üst', icon: '◰' },
  { id: 'top-right', label: 'Sağ üst', icon: '◳' },
  { id: 'bottom', label: 'Alt', icon: '⬓' },
]

// Kartların haritada kapladığı kenar (kart boyutu ölçeğine göre); yakınlaştırmada bu alan boş bırakılır.
function fitPadding(layout: LegLayout, scale: number): FitPadding {
  const column = Math.round(40 + 360 * scale)
  switch (layout) {
    case 'top-left':
      return { topLeft: [column, 110], bottomRight: [50, 50] }
    case 'top-right':
      return { topLeft: [50, 110], bottomRight: [column, 50] }
    case 'bottom':
      return { topLeft: [50, 60], bottomRight: [50, Math.round(120 + 180 * scale)] }
    default:
      return { topLeft: [50, 50], bottomRight: [50, 50] }
  }
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

  // Sağ panel masaüstünde daraltılabilir (varsayılan kapalı); mobilde içerik alt alta aktığı için hep açık.
  const desktop = useMediaQuery('(min-width: 768px)')
  const [panelOpen, setPanelOpen] = useState(() => readPref(PANEL_KEY, ['1', '0'] as const, '0') === '1')
  const setPanel = (open: boolean) => {
    setPanelOpen(open)
    writePref(PANEL_KEY, open ? '1' : '0')
  }
  const panelCollapsed = desktop && !panelOpen

  // Geniş masaüstünde (ya da panel kapalıyken) binişler harita üzerinde yüzen kartlar olarak gösterilir.
  const wide = useMediaQuery('(min-width: 1280px)') || panelCollapsed
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

  // Harita aç/kapa (yalnızca Simülasyon sekmesi); kapalıyken ana alan zaman çizelgesi/karşılaştırma olur.
  const [mapOn, setMapOn] = useState(() => readPref(MAP_KEY, ['1', '0'] as const, '1') === '1')
  const toggleMap = () => {
    setMapOn((on) => {
      writePref(MAP_KEY, on ? '0' : '1')
      return !on
    })
    setActiveLegId(null)
  }
  const [boardView, setBoardView] = useState<BoardView>(() => readPref(BOARD_VIEW_KEY, ['timeline', 'compare'] as const, 'timeline'))
  const chooseBoardView = (v: BoardView) => {
    setBoardView(v)
    writePref(BOARD_VIEW_KEY, v)
  }
  // Biniş kartı boyutu (⚙ ayarlarından); harita üzerindeki kartlara ve harita kapalı listeye uygulanır.
  const cardScale = useCardScale()
  const settings = (
    <SettingsMenu scale={cardScale.scale} onIncrease={cardScale.increase} onDecrease={cardScale.decrease} onReset={cardScale.reset} />
  )
  const mapToggle = (
    <div className="flex items-center gap-1.5">
      {settings}
      <MapToggle on={mapOn} onToggle={toggleMap} />
    </div>
  )
  const boardMode = tab === 'sim' && !mapOn
  const mapControls = (
    <div className="flex items-center gap-1.5">
      {mapToggle}
      <LayoutSwitcher value={mapLayout} onChange={chooseLayout} />
    </div>
  )

  const workspace = (layout: WorkspaceLayout) => (
    <SimWorkspace
      layout={layout}
      cardScale={cardScale.scale}
      boardWide={wide}
      boardView={boardView}
      onBoardView={chooseBoardView}
      mapToggle={mapToggle}
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
      switcher={mapControls}
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
    // Harita kapalıyken mobilde sayfa doğal akışta kayar (ana alan + özet alt alta); masaüstünde yan yana.
    <div className={`flex flex-col md:h-dvh md:flex-row ${boardMode ? 'min-h-dvh' : 'h-dvh'}`}>
      <main className={`relative min-w-0 md:min-h-0 md:flex-1 ${boardMode ? '' : 'min-h-0 flex-1'}`}>
        {tab === 'izban' ? (
          <>
            <NetworkMap fromId={fromId} toId={toId} onStationClick={handleStationClick} />
            <Legend />
          </>
        ) : !mapOn ? (
          workspace('board')
        ) : (
          <>
            <SimMap legs={sim.resolved} activeId={activeLegId} onSelect={onActive} fitPadding={fitPadding(legLayout, cardScale.scale)} />
            {legLayout === 'sidebar' ? (
              <div className="absolute top-3 right-3 z-[650]">{mapToggle}</div>
            ) : (
              <>
                {workspace(legLayout)}
                {legLayout === 'bottom' && <div className="absolute top-3 left-1/2 z-[650] -translate-x-1/2">{mapControls}</div>}
              </>
            )}
          </>
        )}
      </main>
      {panelCollapsed ? (
        <PanelRail
          tab={tab}
          onOpen={() => setPanel(true)}
          onTab={(t) => {
            chooseTab(t)
            // İZBAN ücretinin sonucu panelde gösterildiği için bu sekmede paneli aç.
            if (t === 'izban') setPanel(true)
          }}
        />
      ) : (
      <aside className={`shrink-0 overflow-y-auto ${boardMode ? '' : 'max-h-[60dvh]'} border-t border-[var(--line)] bg-[var(--bg)] md:max-h-none md:w-[440px] md:border-t-0 md:border-l`}>
        <header className="relative z-10 md:sticky md:top-0 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 pt-4 backdrop-blur md:px-6 md:pt-5">
          <button
            type="button"
            onClick={() => setPanel(false)}
            aria-label="Paneli kapat"
            title="Paneli kapat"
            className="absolute top-3 right-3 hidden h-8 w-8 place-items-center rounded-full text-lg text-[var(--muted)] hover:bg-[var(--track)] hover:text-[var(--ink)] md:grid"
          >
            »
          </button>
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
              workspace={mapOn && legLayout === 'sidebar' ? workspace('sidebar') : null}
              hint={
                mapOn
                  ? undefined
                  : 'Harita kapalı: binişler zaman çizelgesinde. Bir çubuğa ya da karta tıklayarak düzenleyin; Karşılaştırma sekmesinde senaryoları yan yana görün.'
              }
            />
          )}
        </div>
      </aside>
      )}
    </div>
  )
}

/** Panel kapalıyken sağda kalan ince şerit: paneli açma ve sekme geçişi. */
function PanelRail({ tab, onOpen, onTab }: { tab: Tab; onOpen: () => void; onTab: (t: Tab) => void }) {
  const item = (active: boolean) =>
    `grid h-9 w-9 place-items-center rounded-lg text-sm font-bold transition ${active ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--ink)] hover:bg-[var(--track)]'}`
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-2 border-l border-[var(--line)] bg-[var(--bg)] py-3" aria-label="Kapalı panel">
      <button type="button" onClick={onOpen} aria-label="Paneli aç" title="Paneli aç" className={`${item(false)} text-lg text-[var(--muted)]`}>
        «
      </button>
      <div className="my-1 h-px w-6 bg-[var(--line)]" />
      <div role="tablist" aria-label="Görünüm" aria-orientation="vertical" className="flex flex-col gap-2">
        <button type="button" role="tab" aria-selected={tab === 'sim'} onClick={() => onTab('sim')} title="Yolculuk Simülasyonu" aria-label="Yolculuk Simülasyonu" className={item(tab === 'sim')}>
          ₺
        </button>
        <button type="button" role="tab" aria-selected={tab === 'izban'} onClick={() => onTab('izban')} title="İZBAN Ücreti" aria-label="İZBAN Ücreti" className={item(tab === 'izban')}>
          <span className="rounded bg-[var(--izban)] px-1 text-[10px] leading-4 text-white">İZ</span>
        </button>
      </div>
    </aside>
  )
}

function MapToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? 'Haritayı kapat' : 'Haritayı göster'}
      title={on ? 'Haritayı kapat (zaman çizelgesi ve karşılaştırma)' : 'Haritayı göster'}
      className={`flex h-9 items-center gap-1.5 rounded-full border text-xs ${on ? 'w-9 justify-center' : 'px-3'} font-semibold whitespace-nowrap shadow-sm backdrop-blur transition ${
        on ? 'border-transparent bg-[var(--bg)]/90 text-[var(--ink)] hover:bg-[var(--surface)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink)]'
      }`}
    >
      <span aria-hidden className="text-sm leading-none">🗺</span>
      {!on && 'Haritayı göster'}
    </button>
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
