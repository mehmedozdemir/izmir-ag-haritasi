import type { SimulationResult } from '../../fare/engine'
import type { RouteInfo } from '../../transit/data'
import type { Scenario, ScenarioInput } from '../../sim/scenarios'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { Compare } from './Compare'
import { LegList, type LegLayout } from './LegList'
import { ScenarioBar, type ScenarioEditing } from './ScenarioBar'
import { LegBoard } from './LegBoard'

/** Harita kapalıyken ana alandaki görünüm. */
export type BoardView = 'timeline' | 'compare'

/** Harita açıkken LegLayout; harita kapalıyken 'board' (ana alanı kaplayan çalışma alanı). */
export type WorkspaceLayout = LegLayout | 'board'

type Props = {
  layout: WorkspaceLayout
  scenarios: Scenario[]
  active: Scenario | undefined
  onSelect: (id: string) => void
  onUpdate: (s: Scenario) => void
  onCreate: (input: ScenarioInput) => void
  onDuplicate: (s: Scenario) => void
  onDelete: (s: Scenario) => void
  onLoadExample: () => void
  newInput: () => ScenarioInput
  editing: ScenarioEditing
  onEditing: (e: ScenarioEditing) => void
  routes: RouteInfo[] | undefined
  routesById: Map<string, RouteInfo> | undefined
  routesError: Error | null
  resolved: ResolvedLeg[]
  detail: SimulationResult
  activeLegId: string | null
  onActiveLeg: (id: string | null) => void
  /** Kart yerleşimi seçici; üst yerleşimlerde senaryo şeridinin sağ ucunda durur. */
  switcher?: React.ReactNode
  /** Harita kapalıyken: geniş ekranda biniş kartları soldan sağa, dar ekranda alt alta. */
  boardWide?: boolean
  boardView?: BoardView
  onBoardView?: (v: BoardView) => void
  /** Harita aç/kapa düğmesi (harita kapalıyken şeridin sağ ucunda). */
  mapToggle?: React.ReactNode
}

/** Senaryo şeridi + seçili senaryonun binişleri; yan panelde ya da harita üzerinde yüzen kartlar olarak. */
export function SimWorkspace(p: Props) {
  const board = p.layout === 'board'
  const legLayout: LegLayout = p.layout === 'board' ? (p.boardWide ? 'bottom' : 'sidebar') : p.layout
  const floating = legLayout !== 'sidebar'

  const bar = (
    <ScenarioBar
      scenarios={p.scenarios}
      activeId={p.active?.id ?? null}
      editing={p.editing}
      onEditing={p.onEditing}
      onSelect={p.onSelect}
      newInput={p.newInput}
      onCreate={p.onCreate}
      onUpdate={p.onUpdate}
      onDuplicate={p.onDuplicate}
      onDelete={p.onDelete}
      onLoadExample={p.onLoadExample}
      routesById={p.routesById}
      floating={floating}
      align={p.layout === 'top-right' ? 'end' : 'start'}
      trailing={board ? p.mapToggle : p.layout === 'top-left' || p.layout === 'top-right' ? p.switcher : undefined}
    />
  )

  const legs = p.active && (
    <LegList
      layout={legLayout}
      journey={p.active}
      onJourney={(j) => p.onUpdate({ ...p.active!, ...j })}
      routes={p.routes}
      routesError={p.routesError}
      resolved={p.resolved}
      detail={p.detail}
      activeId={p.activeLegId}
      onActive={p.onActiveLeg}
    />
  )

  if (board) {
    const view = p.boardView ?? 'timeline'
    return (
      <div className="md:h-full md:overflow-y-auto">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 md:p-6">
          {bar}
          {p.active && (
            <>
              <nav className="flex gap-4 border-b border-[var(--line)]" role="tablist" aria-label="Görünüm">
                {(
                  [
                    ['timeline', 'Zaman çizelgesi'],
                    ['compare', 'Karşılaştırma'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={view === id}
                    onClick={() => p.onBoardView?.(id)}
                    className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition ${view === id ? 'border-[var(--izban)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {view === 'compare' && (
                <Compare scenarios={p.scenarios} activeId={p.active.id} onSelect={p.onSelect} routesById={p.routesById} />
              )}
              {/* Zaman çizelgesi sekmesinde liste zaman çubuklarıyla; karşılaştırmada kompakt liste olarak. */}
              <LegBoard
                journey={p.active}
                onJourney={(j) => p.onUpdate({ ...p.active!, ...j })}
                routes={p.routes}
                resolved={p.resolved}
                detail={p.detail}
                activeLegId={p.activeLegId}
                onActive={p.onActiveLeg}
                showBars={view === 'timeline'}
              />
            </>
          )}
        </div>
      </div>
    )
  }

  if (!floating) {
    return (
      <div className="flex flex-col gap-4">
        {bar}
        {legs}
      </div>
    )
  }

  // Kapsayıcı tıklamaları haritaya geçirir; yalnızca kartlar etkileşimlidir.
  // Senaryo şeridi harita genişliği boyunca soldan sağa uzanır; binişler altında (üst yerleşimlerde
  // sol/sağ sütun) ya da şeridin altında soldan sağa (alt yerleşim) dizilir.
  if (p.layout === 'bottom') {
    return (
      <section aria-label="Senaryo ve binişler" className="pointer-events-none absolute right-3 bottom-3 left-3 z-[600] flex max-h-[85%] flex-col gap-2">
        <div className="shrink-0">{bar}</div>
        {legs}
      </section>
    )
  }

  return (
    <section aria-label="Senaryo ve binişler" className="pointer-events-none absolute inset-3 z-[600] flex flex-col gap-2">
      <div className="shrink-0">{bar}</div>
      {legs && (
        <div className={`flex min-h-0 w-[360px] flex-col gap-2 ${p.layout === 'top-right' ? 'self-end' : ''}`}>{legs}</div>
      )}
    </section>
  )
}
