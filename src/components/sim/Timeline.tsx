import type { LegResult, SimulationResult } from '../../fare/engine'
import { fmtMin } from '../../sim/journey'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { tl } from './LegCard'
import { LineBadge } from './LinePicker'

type Props = {
  legs: ResolvedLeg[]
  detail: SimulationResult
  startBalance: number | null
  activeLegId: string | null
  onSelect: (legId: string) => void
}

const HALK_TASIT: [number, number][] = [
  [5 * 60, 7 * 60],
  [19 * 60, 20 * 60],
]

/** Binişleri yatay saat ekseninde, 90 dk aktarma bantları ve bakiye çizgisiyle gösterir. */
export function Timeline({ legs, detail, startBalance, activeLegId, onSelect }: Props) {
  const rows = legs
    .map((leg, i) => ({ leg, n: i + 1, result: detail.legs.find((r) => r.legId === leg.draft.id) }))
    .filter((r): r is { leg: ResolvedLeg; n: number; result: LegResult } => r.leg.complete && !!r.result)

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">
        Zaman çizelgesi için binişleri tamamlayın (hat, biniş ve iniş durağı).
      </p>
    )
  }

  // Aktarma süreleri: her biri yeni sürenin başladığı binişte açılır.
  const windows = rows
    .filter((r) => r.result.window?.openedHere)
    .map((r) => ({ start: r.result.window!.startMin, end: r.result.window!.endMin }))

  const t0 = Math.min(...rows.map((r) => r.leg.boardMin)) - 10
  const t1 = Math.max(...rows.map((r) => r.leg.alightMin), ...windows.map((w) => w.end)) + 10
  const span = t1 - t0
  const pct = (t: number) => `${((t - t0) / span) * 100}%`
  const width = (a: number, b: number) => `${Math.max(((b - a) / span) * 100, 0.8)}%`

  // Eksen: 6–12 arası işaret olacak şekilde 15/30/60 dk adım.
  const step = span <= 120 ? 15 : span <= 300 ? 30 : 60
  const ticks: number[] = []
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t)

  // Halk Taşıt bantları (gece yarısını geçen yolculuklar için gün kaydırmalı).
  const htt: [number, number][] = []
  for (let day = Math.floor(t0 / 1440); day <= Math.floor(t1 / 1440); day++) {
    for (const [a, b] of HALK_TASIT) {
      const s = Math.max(a + day * 1440, t0)
      const e = Math.min(b + day * 1440, t1)
      if (e > s) htt.push([s, e])
    }
  }

  const LANE = 44

  return (
    // Dar ekranda etiketler okunabilsin diye çizelge en az 680px; gerekirse yatay kayar.
    <div className="thin-scroll overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="min-w-[680px] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-[var(--good-soft)] ring-1 ring-[var(--good)]/40" /> 90 dk aktarma süresi
        </span>
        {htt.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-sm bg-[var(--warn)]/15" /> Halk Taşıt saati (%50)
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full bg-[var(--muted)]" /> Biniş → iniş
        </span>
      </div>

      <div className="relative" style={{ height: rows.length * LANE + 28 }}>
        {/* Arka plan bantları */}
        {htt.map(([a, b], i) => (
          <div key={`htt${i}`} className="absolute top-0 bottom-6 bg-[var(--warn)]/10" style={{ left: pct(a), width: width(a, b) }} />
        ))}
        {windows.map((w, i) => (
          <div
            key={`w${i}`}
            className="absolute top-0 bottom-6 rounded-md border border-dashed border-[var(--good)]/50 bg-[var(--good-soft)]/70"
            style={{ left: pct(w.start), width: width(w.start, w.end) }}
            title={`90 dk aktarma: ${fmtMin(w.start)} – ${fmtMin(w.end)}`}
          >
            <span className="absolute right-1 bottom-0.5 text-[10px] font-semibold text-[var(--good)]">{fmtMin(w.end)}'e kadar</span>
          </div>
        ))}

        {/* Biniş çubukları */}
        {rows.map(({ leg, n, result }, i) => {
          const route = leg.route!
          const active = leg.draft.id === activeLegId
          const free = result.status === 'transfer'
          const startPct = ((leg.boardMin - t0) / span) * 100
          const endPct = ((leg.alightMin - t0) / span) * 100
          // Etiket: çubuk solda bitiyorsa sağına, sağda başlıyorsa soluna, ikisi de değilse çubuğun içine.
          const place = endPct < 62 ? 'after' : startPct > 38 ? 'before' : 'inside'
          return (
            <button
              key={leg.draft.id}
              type="button"
              onClick={() => onSelect(leg.draft.id)}
              className="group absolute left-0 right-0 text-left"
              style={{ top: i * LANE + 6, height: LANE - 12 }}
              aria-label={`${n}. biniş: ${route.ref || route.name}, ${leg.from!.name} → ${leg.to!.name}, ${free ? 'aktarma' : tl(result.charged)}`}
            >
              <span
                className={`absolute top-0 bottom-0 rounded-md transition ${active ? 'ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[var(--surface)]' : 'group-hover:brightness-110'}`}
                style={{ left: pct(leg.boardMin), width: width(leg.boardMin, leg.alightMin), background: route.color }}
              />
              <span
                className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-xs ${place === 'before' ? 'flex-row-reverse' : ''} ${
                  place === 'inside' ? 'max-w-full overflow-hidden rounded-md bg-[var(--surface)]/90 px-1 py-0.5' : ''
                }`}
                style={
                  place === 'before'
                    ? { right: `calc(${100 - startPct}% + 6px)` }
                    : place === 'after'
                      ? { left: `calc(${endPct}% + 6px)` }
                      : { left: `calc(${startPct}% + 4px)` }
                }
              >
                <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: route.color }}>
                  {n}
                </span>
                <LineBadge route={route} small />
                <span className="max-w-56 truncate font-semibold text-[var(--ink)]">
                  {leg.from!.name} → {leg.to!.name}
                </span>
                <FareTag result={result} />
              </span>
            </button>
          )
        })}

        {/* Saat ekseni */}
        <div className="absolute right-0 bottom-0 left-0 h-6 border-t border-[var(--line)]">
          {ticks.map((t) => (
            <span key={t} className="absolute top-1 -translate-x-1/2 text-[10px] tabular-nums text-[var(--muted)]" style={{ left: pct(t) }}>
              {fmtMin(t).slice(0, 5)}
            </span>
          ))}
        </div>
      </div>

      {startBalance !== null && <BalanceLine rows={rows} startBalance={startBalance} t0={t0} span={span} />}
      </div>
    </div>
  )
}

function FareTag({ result }: { result: LegResult }) {
  if (result.status === 'transfer') {
    return <span className="rounded-full bg-[var(--good-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--good)]">Aktarma</span>
  }
  return (
    <span className="rounded-full bg-[var(--track)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--ink)]">
      {tl(result.charged)}
      {result.status === 'transfer-partial' && <span className="ml-1 font-semibold text-[var(--good)]">aktarma</span>}
      {result.halkTasit && <span className="ml-1 font-semibold text-[var(--warn)]">%50</span>}
    </span>
  )
}

/** Karttaki bakiyenin binişte (ücret/blokaj) ve inişte (iade) değişimini basamaklı çizgiyle gösterir. */
function BalanceLine({
  rows,
  startBalance,
  t0,
  span,
}: {
  rows: { leg: ResolvedLeg; result: LegResult }[]
  startBalance: number
  t0: number
  span: number
}) {
  const events: { t: number; balance: number }[] = [{ t: t0, balance: startBalance }]
  for (const { leg, result } of rows) {
    events.push({ t: leg.boardMin, balance: result.balanceAfterBoard ?? startBalance })
    events.push({ t: leg.alightMin, balance: result.balanceAfterAlight ?? startBalance })
  }
  events.push({ t: t0 + span, balance: events[events.length - 1].balance })

  const H = 60
  const values = events.map((e) => e.balance)
  const lo = Math.min(0, ...values)
  const hi = Math.max(...values)
  const y = (b: number) => H - 6 - ((b - lo) / (hi - lo || 1)) * (H - 12)
  const x = (t: number) => ((t - t0) / span) * 1000

  let d = `M ${x(events[0].t)} ${y(events[0].balance)}`
  for (let i = 1; i < events.length; i++) {
    d += ` H ${x(events[i].t)} V ${y(events[i].balance)}`
  }

  // Yalnızca bakiyenin değiştiği noktalara etiket koy.
  const labels = events.filter((e, i) => i > 0 && i < events.length - 1 && e.balance !== events[i - 1].balance)

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        <span>Kart bakiyesi</span>
        <span className="normal-case tracking-normal tabular-nums">
          {tl(startBalance)} → <strong className="text-[var(--ink)]">{tl(events[events.length - 1].balance)}</strong>
        </span>
      </div>
      <div className="relative" style={{ height: H }}>
        <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {lo < 0 && <line x1={0} x2={1000} y1={y(0)} y2={y(0)} stroke="var(--warn)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
          <path d={d} fill="none" stroke="var(--info)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {labels.map((e, i) => (
          <span
            key={i}
            className={`absolute -translate-x-1/2 -translate-y-full rounded bg-[var(--surface)] px-1 text-[10px] font-semibold tabular-nums ${e.balance < 0 ? 'text-[var(--warn)]' : 'text-[var(--ink)]'}`}
            style={{ left: `${x(e.t) / 10}%`, top: y(e.balance) - 2 }}
          >
            {e.balance.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
          </span>
        ))}
      </div>
    </div>
  )
}
