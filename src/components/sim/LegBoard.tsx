import type { LegResult, SimulationResult } from '../../fare/engine'
import { CARD_TYPES } from '../../fare/tariffs'
import type { RouteInfo } from '../../transit/data'
import { fmtMin, type Journey } from '../../sim/journey'
import { legOps, legSummary } from '../../sim/legOps'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { FareBadge, LegCard, tl } from './LegCard'
import { LineBadge } from './LinePicker'

type Props = {
  journey: Journey
  onJourney: (j: Journey) => void
  routes: RouteInfo[] | undefined
  resolved: ResolvedLeg[]
  detail: SimulationResult
  activeLegId: string | null
  onActive: (id: string | null) => void
  /** Zaman çubukları (Zaman çizelgesi sekmesi); kapalıyken yalnızca kompakt liste. */
  showBars: boolean
}

const HALK_TASIT: [number, number][] = [
  [5 * 60, 7 * 60],
  [19 * 60, 20 * 60],
]

// Sol bilgi sütunu sabit genişlikte; dar ekranda zaman sütunu yatay kayarken bilgi sütunu yerinde kalır.
const INFO_COL = 'w-[22rem] shrink-0'

type Scale = {
  t0: number
  span: number
  pct: (t: number) => string
  width: (a: number, b: number) => string
  ticks: number[]
  htt: [number, number][]
  windows: { start: number; end: number }[]
}

function makeScale(rows: { leg: ResolvedLeg; result: LegResult }[]): Scale {
  const windows = rows
    .filter((r) => r.result.window?.openedHere)
    .map((r) => ({ start: r.result.window!.startMin, end: r.result.window!.endMin }))
  const t0 = Math.min(...rows.map((r) => r.leg.boardMin)) - 10
  const t1 = Math.max(...rows.map((r) => r.leg.alightMin), ...windows.map((w) => w.end)) + 10
  const span = t1 - t0
  const step = span <= 120 ? 15 : span <= 300 ? 30 : 60
  const ticks: number[] = []
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t)
  const htt: [number, number][] = []
  for (let day = Math.floor(t0 / 1440); day <= Math.floor(t1 / 1440); day++) {
    for (const [a, b] of HALK_TASIT) {
      const s = Math.max(a + day * 1440, t0)
      const e = Math.min(b + day * 1440, t1)
      if (e > s) htt.push([s, e])
    }
  }
  return {
    t0,
    span,
    pct: (t) => `${((t - t0) / span) * 100}%`,
    width: (a, b) => `${Math.max(((b - a) / span) * 100, 0.8)}%`,
    ticks,
    htt,
    windows,
  }
}

/**
 * Harita kapalıyken binişlerin tek listesi: her satırda solda kısa özet, sağda zaman çubuğu
 * (90 dk aktarma ve Halk Taşıt bantlarıyla). Satıra tıklanınca düzenleme formu satırın altında açılır.
 */
export function LegBoard({ journey, onJourney, routes, resolved, detail, activeLegId, onActive, showBars }: Props) {
  const ops = legOps(journey, onJourney, onActive)
  const results = new Map(detail.legs.map((r) => [r.legId, r]))
  const timed = resolved
    .map((leg) => ({ leg, result: results.get(leg.draft.id) }))
    .filter((r): r is { leg: ResolvedLeg; result: LegResult } => r.leg.complete && !!r.result && r.result.status !== 'pending')
  const scale = showBars && timed.length > 0 ? makeScale(timed) : null
  const cardLabel = CARD_TYPES.find((c) => c.type === journey.detailCard)!.label

  return (
    <section aria-label="Binişler" className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--line)] px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Binişler · {cardLabel} kart</h2>
        <span className="text-xs font-semibold tabular-nums text-[var(--ink)]">{legSummary(journey, detail)}</span>
        {scale && (
          <span className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-4 rounded-sm bg-[var(--good-soft)] ring-1 ring-[var(--good)]/40" /> 90 dk aktarma
            </span>
            {scale.htt.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-4 rounded-sm bg-[var(--warn)]/20" /> Halk Taşıt
              </span>
            )}
          </span>
        )}
        {journey.legs.length > 0 && (
          <button type="button" onClick={ops.clear} className="ml-auto text-xs font-semibold text-[var(--muted)] hover:text-[var(--warn)]">
            Temizle
          </button>
        )}
      </header>

      <div className={scale ? 'thin-scroll overflow-x-auto' : ''}>
        <ol className={scale ? 'min-w-[48rem]' : ''}>
          {scale && (
            <li className="flex border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]" aria-hidden>
              <div className={`${INFO_COL} sticky left-0 z-10 flex items-center bg-[var(--surface)] px-3 py-1.5`}>
                <span className="w-7">#</span>
                <span className="flex-1">Hat · Biniş → İniş</span>
                <span>Ücret</span>
              </div>
              <div className="relative h-7 flex-1 border-l border-[var(--line)]">
                {scale.ticks.map((t) => (
                  <span key={t} className="absolute top-1.5 -translate-x-1/2 tabular-nums" style={{ left: scale.pct(t) }}>
                    {fmtMin(t).slice(0, 5)}
                  </span>
                ))}
              </div>
            </li>
          )}

          {routes &&
            resolved.map((leg, i) =>
              leg.draft.id === activeLegId ? (
                <LegCard
                  key={leg.draft.id}
                  index={i}
                  leg={leg}
                  result={results.get(leg.draft.id)}
                  routes={routes}
                  expanded
                  inlinePicker
                  className="sticky left-0 m-2 max-w-[44rem]"
                  onExpand={() => onActive(leg.draft.id)}
                  onCollapse={() => onActive(null)}
                  canMoveUp={i > 0}
                  canMoveDown={i < resolved.length - 1}
                  onChange={(patch) => ops.update(leg.draft.id, patch)}
                  onRemove={() => ops.remove(leg.draft.id, activeLegId)}
                  onMove={(d) => ops.move(i, d)}
                />
              ) : (
                <BoardRow key={leg.draft.id} n={i + 1} leg={leg} result={results.get(leg.draft.id)} scale={scale} onClick={() => onActive(leg.draft.id)} />
              ),
            )}

          <li className={`flex ${scale ? 'border-t border-[var(--line)]' : ''}`}>
            <button
              type="button"
              onClick={ops.add}
              className={`${scale ? INFO_COL : 'w-full'} sticky left-0 bg-[var(--surface)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]`}
            >
              + Biniş ekle
            </button>
            {scale && <div className="flex-1 border-l border-[var(--line)]" />}
          </li>
        </ol>

        {scale && journey.startBalance !== null && <BalanceRow rows={timed} startBalance={journey.startBalance} scale={scale} />}
      </div>
    </section>
  )
}

function BoardRow({
  n,
  leg,
  result,
  scale,
  onClick,
}: {
  n: number
  leg: ResolvedLeg
  result: LegResult | undefined
  scale: Scale | null
  onClick: () => void
}) {
  const route = leg.route
  const times = leg.complete ? `${fmtMin(leg.boardMin)}–${fmtMin(leg.alightMin)}` : fmtMin(leg.boardMin)
  const label = `${n}. biniş${route ? `: ${route.ref || route.name}` : ''}${leg.from && leg.to ? `, ${leg.from.name} → ${leg.to.name}` : ''} — düzenle`

  return (
    <li className="group flex border-t border-[var(--line)] first:border-t-0">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`${scale ? INFO_COL : 'w-full'} sticky left-0 z-10 flex h-11 items-center gap-2 bg-[var(--surface)] px-3 text-left group-hover:bg-[var(--bg)]`}
      >
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
          style={{ background: route?.color ?? 'var(--muted)' }}
        >
          {n}
        </span>
        {route ? (
          <>
            <LineBadge route={route} small />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight text-[var(--ink)]">
                {leg.from && leg.to ? `${leg.from.name} → ${leg.to.name}` : <span className="font-normal text-[var(--muted)]">durak seçilmedi</span>}
              </span>
              <span className="block text-[11px] leading-tight tabular-nums text-[var(--muted)]">{times}</span>
            </span>
            {leg.complete && <FareBadge leg={leg} result={result} />}
          </>
        ) : (
          <span className="flex-1 truncate text-sm text-[var(--muted)]">Hat seçilmedi — düzenlemek için tıklayın</span>
        )}
      </button>

      {scale && (
        <div className="relative h-11 flex-1 cursor-pointer border-l border-[var(--line)]" onClick={onClick} aria-hidden>
          {scale.htt.map(([a, b], i) => (
            <div key={`h${i}`} className="absolute inset-y-0 bg-[var(--warn)]/10" style={{ left: scale.pct(a), width: scale.width(a, b) }} />
          ))}
          {scale.windows.map((w, i) => (
            <div key={`w${i}`} className="absolute inset-y-0 bg-[var(--good-soft)]/70" style={{ left: scale.pct(w.start), width: scale.width(w.start, w.end) }} />
          ))}
          {leg.complete && route && (
            <div
              className="absolute top-3 bottom-3 rounded group-hover:brightness-110"
              style={{ left: scale.pct(leg.boardMin), width: scale.width(leg.boardMin, leg.alightMin), background: route.color }}
              title={`${times} · ${result?.status === 'transfer' ? 'aktarma' : result ? tl(result.charged) : ''}`}
            />
          )}
          {result?.window?.openedHere && (
            <span
              className="absolute top-0.5 text-[9px] font-semibold whitespace-nowrap text-[var(--good)]"
              style={{ left: `calc(${scale.pct(result.window.startMin)} + 2px)` }}
            >
              90 dk · {fmtMin(result.window.endMin)}'e kadar
            </span>
          )}
        </div>
      )}
    </li>
  )
}

/** Karttaki bakiyenin binişte (ücret/blokaj) ve inişte (iade) değişimi, zaman ekseniyle hizalı. */
function BalanceRow({ rows, startBalance, scale }: { rows: { leg: ResolvedLeg; result: LegResult }[]; startBalance: number; scale: Scale }) {
  const events: { t: number; balance: number }[] = [{ t: scale.t0, balance: startBalance }]
  for (const { leg, result } of rows) {
    events.push({ t: leg.boardMin, balance: result.balanceAfterBoard ?? startBalance })
    events.push({ t: leg.alightMin, balance: result.balanceAfterAlight ?? startBalance })
  }
  const end = events[events.length - 1].balance
  events.push({ t: scale.t0 + scale.span, balance: end })

  const H = 48
  const values = events.map((e) => e.balance)
  const lo = Math.min(0, ...values)
  const hi = Math.max(...values)
  const y = (b: number) => H - 6 - ((b - lo) / (hi - lo || 1)) * (H - 14)
  const x = (t: number) => ((t - scale.t0) / scale.span) * 1000
  let d = `M ${x(events[0].t)} ${y(events[0].balance)}`
  for (let i = 1; i < events.length; i++) d += ` H ${x(events[i].t)} V ${y(events[i].balance)}`
  const labels = events.filter((e, i) => i > 0 && i < events.length - 1 && e.balance !== events[i - 1].balance)

  return (
    <div className="flex min-w-[48rem] border-t border-[var(--line)]">
      <div className={`${INFO_COL} sticky left-0 z-10 flex items-center justify-between bg-[var(--surface)] px-3 text-xs`}>
        <span className="font-semibold uppercase tracking-wide text-[var(--muted)]">Kart bakiyesi</span>
        <span className="tabular-nums text-[var(--muted)]">
          {tl(startBalance)} → <strong className={end < 0 ? 'text-[var(--warn)]' : 'text-[var(--ink)]'}>{tl(end)}</strong>
        </span>
      </div>
      <div className="relative flex-1 border-l border-[var(--line)]" style={{ height: H }}>
        <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {lo < 0 && <line x1={0} x2={1000} y1={y(0)} y2={y(0)} stroke="var(--warn)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
          <path d={d} fill="none" stroke="var(--info)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {labels.map((e, i) => (
          <span
            key={i}
            className={`absolute -translate-x-1/2 -translate-y-full px-0.5 text-[10px] font-semibold tabular-nums ${e.balance < 0 ? 'text-[var(--warn)]' : 'text-[var(--ink)]'}`}
            style={{ left: `${x(e.t) / 10}%`, top: y(e.balance) - 1 }}
          >
            {e.balance.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
          </span>
        ))}
      </div>
    </div>
  )
}
