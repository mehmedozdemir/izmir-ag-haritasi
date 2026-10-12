import type { SimulationResult } from '../../fare/engine'
import { CARD_TYPES } from '../../fare/tariffs'
import type { RouteInfo } from '../../transit/data'
import type { Journey } from '../../sim/journey'
import { legOps, legSummary } from '../../sim/legOps'
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
  const ops = legOps(journey, onJourney, onActive)
  const onMap = layout !== 'sidebar'
  const grid = layout === 'bottom'
  const cardLabel = CARD_TYPES.find((c) => c.type === journey.detailCard)!.label

  const header = (
    <div
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 ${onMap ? 'pointer-events-auto rounded-lg bg-[var(--bg)]/90 px-3 py-1.5 shadow-sm backdrop-blur' : 'mb-2'}`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Binişler · {cardLabel} kart</h2>
      <span className="text-xs tabular-nums text-[var(--muted)]">{legSummary(journey, detail)}</span>
      {journey.legs.length > 0 && (
        <button type="button" onClick={ops.clear} className="ml-auto text-xs font-semibold text-[var(--muted)] hover:text-[var(--warn)]">
          Temizle
        </button>
      )}
    </div>
  )

  const addButton = (
    <button
      type="button"
      onClick={ops.add}
      className={`pointer-events-auto w-full shrink-0 rounded-xl border border-dashed py-2 text-sm font-semibold transition ${
        onMap
          ? 'border-[var(--muted)] bg-[var(--bg)]/85 text-[var(--ink)] shadow-sm backdrop-blur hover:bg-[var(--bg)]'
          : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
      }`}
    >
      + Biniş ekle
    </button>
  )

  if (routesError) return <p className="text-sm text-[var(--warn)]">Hat verisi yüklenemedi: {routesError.message}</p>

  const list = !routes ? (
    <div className="pointer-events-auto h-32 w-full animate-pulse rounded-xl bg-[var(--track)]" />
  ) : (
    <ol className={grid ? 'contents' : 'flex flex-col gap-1.5'}>
      {resolved.map((leg, i) => {
        const expanded = leg.draft.id === activeId
        return (
          <LegCard
            key={leg.draft.id}
            index={i}
            leg={leg}
            result={detail.legs.find((r) => r.legId === leg.draft.id)}
            routes={routes}
            expanded={expanded}
            floating={onMap}
            inlinePicker={onMap}
            // Alt yerleşimde ızgara: açık kart tüm satırı kaplar.
            className={grid && expanded ? 'col-span-full' : undefined}
            onExpand={() => onActive(leg.draft.id)}
            onCollapse={() => onActive(null)}
            canMoveUp={i > 0}
            canMoveDown={i < resolved.length - 1}
            moveLabels={grid ? ['Öne al', 'Sona al'] : undefined}
            onChange={(patch) => ops.update(leg.draft.id, patch)}
            onRemove={() => ops.remove(leg.draft.id, activeId)}
            onMove={(d) => ops.move(i, d)}
          />
        )
      })}
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

  // Harita üzerinde: konumlandırmayı SimWorkspace yapar; burada başlık ve kaydırılabilir kart listesi döner.
  // Alt yerleşimde kartlar yatay taşmak yerine çok sütunlu ızgarada akar ve liste haritanın yarısını geçmez.
  return (
    <>
      <div className={grid ? 'self-start' : ''}>{header}</div>
      <div
        className={
          grid
            ? 'thin-scroll grid max-h-[45vh] min-h-0 grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] content-start gap-1.5 overflow-y-auto pr-1'
            : 'thin-scroll flex min-h-0 flex-col gap-1.5 overflow-y-auto pr-1'
        }
      >
        {list}
        {addButton}
      </div>
    </>
  )
}
