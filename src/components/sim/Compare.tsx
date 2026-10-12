import { useCallback, useEffect, useState } from 'react'
import { CARD_TYPES, type CardType } from '../../fare/tariffs'
import type { RouteInfo } from '../../transit/data'
import { fmtMin } from '../../sim/journey'
import { scenarioName, type Scenario } from '../../sim/scenarios'
import { useSimulation } from '../../sim/useSimulation'
import { tl } from './LegCard'
import { LineBadge } from './LinePicker'

type Props = {
  scenarios: Scenario[]
  activeId: string | null
  onSelect: (id: string) => void
  routesById: Map<string, RouteInfo> | undefined
}

type Totals = Record<CardType, number | null>

const LEG_ROW = 'h-16'
const TOTAL_ROW = 'h-10'

/** Senaryoları yan yana karşılaştırır: satırlar binişler ve kart tipine göre toplamlar. */
export function Compare({ scenarios, activeId, onSelect, routesById }: Props) {
  const [totals, setTotals] = useState<Record<string, Totals>>({})
  const report = useCallback((id: string, t: Totals) => {
    setTotals((prev) => (JSON.stringify(prev[id]) === JSON.stringify(t) ? prev : { ...prev, [id]: t }))
  }, [])

  if (scenarios.length === 0) return null
  const maxLegs = Math.max(1, ...scenarios.map((s) => s.legs.length))

  // Her kart tipinde en düşük toplam (birden fazla senaryo varsa vurgulanır).
  const cheapest = Object.fromEntries(
    CARD_TYPES.map(({ type }) => {
      const vals = scenarios.map((s) => totals[s.id]?.[type]).filter((v): v is number => typeof v === 'number')
      return [type, scenarios.length > 1 && vals.length > 1 ? Math.min(...vals) : null]
    }),
  ) as Record<CardType, number | null>

  return (
    <div className="thin-scroll overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex min-w-fit">
        {/* Satır başlıkları */}
        <div className="sticky left-0 z-10 w-28 shrink-0 border-r border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--muted)]">
          <div className="flex h-16 items-end px-3 pb-2 uppercase tracking-wide">Senaryo</div>
          {Array.from({ length: maxLegs }, (_, i) => (
            <div key={i} className={`flex ${LEG_ROW} items-center border-t border-[var(--line)] px-3`}>
              {i + 1}. biniş
            </div>
          ))}
          {CARD_TYPES.map(({ type, label }, i) => (
            <div key={type} className={`flex ${TOTAL_ROW} items-center px-3 ${i === 0 ? 'border-t-2 border-[var(--ink)]/30' : 'border-t border-[var(--line)]'}`}>
              {label} toplam
            </div>
          ))}
        </div>

        {scenarios.map((s) => (
          <ScenarioColumn
            key={s.id}
            scenario={s}
            active={s.id === activeId}
            maxLegs={maxLegs}
            cheapest={cheapest}
            routesById={routesById}
            onSelect={() => onSelect(s.id)}
            onTotals={report}
          />
        ))}
      </div>
    </div>
  )
}

function ScenarioColumn({
  scenario,
  active,
  maxLegs,
  cheapest,
  routesById,
  onSelect,
  onTotals,
}: {
  scenario: Scenario
  active: boolean
  maxLegs: number
  cheapest: Record<CardType, number | null>
  routesById: Map<string, RouteInfo> | undefined
  onSelect: () => void
  onTotals: (id: string, t: Totals) => void
}) {
  const { resolved, results } = useSimulation(scenario, routesById)
  const detail = results[scenario.detailCard]
  // Tamamlanmış binişi olmayan senaryonun toplamı yok sayılır (0 TL "en ucuz" görünmesin).
  const hasLegs = resolved.some((l) => l.complete)
  const totals = Object.fromEntries(CARD_TYPES.map(({ type }) => [type, hasLegs ? results[type].total : null])) as Totals
  const totalsKey = JSON.stringify(totals)
  useEffect(() => onTotals(scenario.id, JSON.parse(totalsKey) as Totals), [scenario.id, totalsKey, onTotals])

  const cardLabel = CARD_TYPES.find((c) => c.type === scenario.detailCard)!.label

  return (
    <div className={`w-52 shrink-0 border-r border-[var(--line)] last:border-r-0 ${active ? 'bg-[var(--bg)]' : ''}`}>
      <button
        type="button"
        onClick={onSelect}
        className={`flex h-16 w-full flex-col justify-end px-3 pb-2 text-left ${active ? 'shadow-[inset_0_3px_0_var(--izban)]' : 'hover:bg-[var(--bg)]'}`}
        title={active ? 'Seçili senaryo' : 'Bu senaryoyu seç'}
      >
        <span className="truncate text-sm font-bold text-[var(--ink)]">{scenarioName(scenario)}</span>
        <span className="truncate text-[11px] tabular-nums text-[var(--muted)]">
          {scenario.date.split('-').reverse().slice(0, 2).join('.')} · {scenario.startTime} · {cardLabel}
          {!scenario.settings.izbanTransfer && ' · İZBAN aktarmasız'}
        </span>
      </button>

      {Array.from({ length: maxLegs }, (_, i) => {
        const leg = resolved[i]
        const r = leg && detail.legs.find((x) => x.legId === leg.draft.id)
        return (
          <div key={i} className={`flex ${LEG_ROW} flex-col justify-center gap-0.5 border-t border-[var(--line)] px-3`}>
            {leg?.route ? (
              <>
                <span className="flex min-w-0 items-center gap-1.5">
                  <LineBadge route={leg.route} small />
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--ink)]">
                    {leg.from && leg.to ? `${leg.from.name} → ${leg.to.name}` : 'Durak seçilmedi'}
                  </span>
                </span>
                <span className="flex items-baseline justify-between text-xs">
                  <span className="tabular-nums text-[var(--muted)]">{fmtMin(leg.boardMin)}</span>
                  {!r ? (
                    <span className="text-[var(--muted)]">—</span>
                  ) : r.status === 'pending' ? (
                    <span className="text-[var(--muted)]">…</span>
                  ) : r.status === 'transfer' ? (
                    <span className="font-semibold text-[var(--good)]">Aktarma</span>
                  ) : (
                    <span className="font-bold tabular-nums text-[var(--ink)]">{tl(r.charged)}</span>
                  )}
                </span>
              </>
            ) : (
              <span className="text-xs text-[var(--muted)]">—</span>
            )}
          </div>
        )
      })}

      {CARD_TYPES.map(({ type }, i) => {
        const v = totals[type]
        const best = v !== null && cheapest[type] !== null && v === cheapest[type]
        const own = type === scenario.detailCard
        return (
          <div
            key={type}
            className={`flex ${TOTAL_ROW} items-center justify-end gap-1.5 px-3 tabular-nums ${i === 0 ? 'border-t-2 border-[var(--ink)]/30' : 'border-t border-[var(--line)]'} ${
              best ? 'bg-[var(--good-soft)]' : ''
            }`}
          >
            {best && <span className="text-[10px] font-bold uppercase text-[var(--good)]">en ucuz</span>}
            <span className={`font-display text-base ${own ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--muted)]'}`}>
              {!hasLegs ? '—' : v === null ? '…' : tl(v)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
