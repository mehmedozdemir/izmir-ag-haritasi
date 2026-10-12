import type { SimulationResult } from '../../fare/engine'
import { CARD_TYPES } from '../../fare/tariffs'
import type { RouteInfo } from '../../transit/data'
import { exampleLegs, newLegId, type Journey, type LegDraft } from '../../sim/journey'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { LegCard } from './LegCard'

/** Binişlerin nerede gösterileceği: yan panelde ya da harita üzerinde üç yerleşimden birinde. */
export type LegLayout = 'sidebar' | 'top-left' | 'top-right' | 'bottom'

type Props = {
  layout: LegLayout
  journey: Journey
  onJourney: (j: Journey) => void
  routes: RouteInfo[] | undefined
  routesError: Error | null
  resolved: ResolvedLeg[]
  detail: SimulationResult
  activeId: string | null
  onActive: (id: string | null) => void
}

export function LegList({ layout, journey, onJourney, routes, routesError, resolved, detail, activeId, onActive }: Props) {
  const setLegs = (legs: LegDraft[]) => onJourney({ ...journey, legs })
  const updateLeg = (id: string, patch: Partial<LegDraft>) =>
    setLegs(journey.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const moveLeg = (i: number, delta: -1 | 1) => {
    const legs = [...journey.legs]
    ;[legs[i], legs[i + delta]] = [legs[i + delta], legs[i]]
    setLegs(legs)
  }
  const addLeg = () => {
    const id = newLegId()
    setLegs([...journey.legs, { id }])
    onActive(id)
  }

  const onMap = layout !== 'sidebar'
  const horizontal = layout === 'bottom'
  const isEmpty = journey.legs.every((l) => !l.routeId)
  const cardLabel = CARD_TYPES.find((c) => c.type === journey.detailCard)!.label

  const header = (
    <div className={`flex items-baseline justify-between gap-3 ${onMap ? 'pointer-events-auto rounded-lg bg-[var(--bg)]/90 px-3 py-1.5 shadow-sm backdrop-blur' : 'mb-2'}`}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Binişler · {cardLabel} kart</h2>
      {isEmpty && (
        <button
          type="button"
          onClick={() => {
            setLegs(exampleLegs())
            onActive(null)
          }}
          className="text-xs font-semibold text-[var(--info)] hover:underline"
        >
          Örnek yolculuk yükle
        </button>
      )}
    </div>
  )

  const addButton = (
    <button
      type="button"
      onClick={addLeg}
      className={`pointer-events-auto shrink-0 rounded-xl border border-dashed text-sm font-semibold transition ${
        onMap
          ? 'border-[var(--muted)] bg-[var(--bg)]/85 text-[var(--ink)] shadow-sm backdrop-blur hover:bg-[var(--bg)]'
          : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
      } ${horizontal ? 'w-36 self-end py-6' : 'w-full py-2.5'}`}
    >
      + Biniş ekle
    </button>
  )

  if (routesError) return <p className="text-sm text-[var(--warn)]">Hat verisi yüklenemedi: {routesError.message}</p>

  const list = !routes ? (
    <div className="pointer-events-auto h-32 w-full animate-pulse rounded-xl bg-[var(--track)]" />
  ) : (
    <ol className={horizontal ? 'contents' : 'flex flex-col gap-2'}>
      {resolved.map((leg, i) => (
        <LegCard
          key={leg.draft.id}
          index={i}
          leg={leg}
          result={detail.legs.find((r) => r.legId === leg.draft.id)}
          routes={routes}
          expanded={leg.draft.id === activeId}
          floating={onMap}
          inlinePicker={onMap}
          className={horizontal ? 'w-80 shrink-0' : undefined}
          scrollable={horizontal}
          onExpand={() => onActive(leg.draft.id)}
          onCollapse={() => onActive(null)}
          canMoveUp={i > 0}
          canMoveDown={i < resolved.length - 1}
          moveLabels={horizontal ? ['Sola taşı', 'Sağa taşı'] : undefined}
          onChange={(patch) => updateLeg(leg.draft.id, patch)}
          onRemove={() => {
            setLegs(journey.legs.filter((l) => l.id !== leg.draft.id))
            if (activeId === leg.draft.id) onActive(null)
          }}
          onMove={(d) => moveLeg(i, d)}
        />
      ))}
    </ol>
  )

  if (layout === 'sidebar') {
    return (
      <section aria-label="Binişler">
        {header}
        {list}
        <div className="mt-3">{addButton}</div>
      </section>
    )
  }

  // Harita üzerinde: kapsayıcı tıklamaları haritaya geçirir, yalnızca kartlar etkileşimlidir.
  const position =
    layout === 'top-left'
      ? 'top-3 bottom-3 left-3 w-[360px] flex-col'
      : layout === 'top-right'
        ? 'top-3 bottom-3 right-3 w-[360px] flex-col'
        : 'bottom-3 left-3 right-3 max-h-[75%] flex-col'

  return (
    <section aria-label="Binişler" className={`pointer-events-none absolute z-[600] flex gap-2 ${position}`}>
      <div className={horizontal ? 'self-start' : ''}>{header}</div>
      <div
        className={
          horizontal
            ? 'flex min-h-0 items-end gap-2 overflow-x-auto overflow-y-hidden pb-1'
            : 'flex min-h-0 flex-col gap-2 overflow-y-auto pr-1'
        }
      >
        {list}
        {addButton}
      </div>
    </section>
  )
}
