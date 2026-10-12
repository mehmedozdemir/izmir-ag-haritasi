import type { LegResult } from '../../fare/engine'
import { TARIFFS } from '../../fare/tariffs'
import type { RouteInfo } from '../../transit/data'
import { fmtMin, type LegDraft } from '../../sim/journey'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { LinePicker } from './LinePicker'

type Props = {
  index: number
  leg: ResolvedLeg
  result: LegResult | undefined
  routes: RouteInfo[]
  canMoveUp: boolean
  canMoveDown: boolean
  onChange: (patch: Partial<LegDraft>) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
}

export const tl = (n: number) =>
  `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`

export function LegCard({ index, leg, result, routes, canMoveUp, canMoveDown, onChange, onRemove, onMove }: Props) {
  const { route, dir, from, to } = leg
  const stops = dir?.stops ?? []
  const fromIdx = stops.findIndex((s) => s.id === from?.id)
  const toOptions = route?.anyOrder ? stops.filter((s) => s.id !== from?.id) : fromIdx >= 0 ? stops.slice(fromIdx + 1) : []
  const accent = route?.color ?? 'var(--line)'

  return (
    <li className="relative rounded-xl border border-[var(--line)] bg-[var(--surface)]" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--line)] px-3 py-2">
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
          style={{ background: route?.color ?? 'var(--muted)' }}
        >
          {index + 1}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Biniş
          <input
            type="time"
            value={fmtMin(leg.boardMin).slice(0, 5)}
            onChange={(e) => onChange({ boardOverride: e.target.value || undefined })}
            className={`rounded border px-1 py-0.5 text-sm font-semibold tabular-nums text-[var(--ink)] ${leg.autoBoard ? 'border-transparent bg-transparent' : 'border-[var(--ink)]'}`}
            aria-label={`${index + 1}. biniş saati`}
          />
        </label>
        {!leg.autoBoard && (
          <button type="button" onClick={() => onChange({ boardOverride: undefined })} className="text-xs text-[var(--muted)] underline">
            otomatik
          </button>
        )}
        {leg.complete && <span className="text-xs text-[var(--muted)] tabular-nums">→ iniş ~{fmtMin(leg.alightMin)}</span>}
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="Yukarı taşı" disabled={!canMoveUp} onClick={() => onMove(-1)}>↑</IconButton>
          <IconButton label="Aşağı taşı" disabled={!canMoveDown} onClick={() => onMove(1)}>↓</IconButton>
          <IconButton label="Binişi sil" onClick={onRemove}>✕</IconButton>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <LinePicker
          routes={routes}
          value={route}
          onChange={(r) => onChange({ routeId: r.id, dirId: r.dirs[0]?.id, fromStopId: undefined, toStopId: undefined })}
        />

        {route && route.dirs.length > 1 && !route.anyOrder && (
          <div className="flex gap-1" role="group" aria-label="Yön">
            {route.dirs.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={d.id === leg.draft.dirId}
                onClick={() => onChange({ dirId: d.id, fromStopId: undefined, toStopId: undefined })}
                className={`min-w-0 flex-1 truncate rounded-md border px-2 py-1 text-xs ${d.id === leg.draft.dirId ? 'border-[var(--ink)] font-semibold text-[var(--ink)]' : 'border-[var(--line)] text-[var(--muted)]'}`}
                title={d.name}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}

        {route && (
          <div className="grid grid-cols-2 gap-2">
            <StopSelect
              label="Biniş durağı"
              value={from?.id}
              options={route.anyOrder ? stops : stops.slice(0, -1)}
              loading={!dir}
              onChange={(id) => {
                const nextFromIdx = stops.findIndex((s) => s.id === id)
                const toIdx = stops.findIndex((s) => s.id === leg.draft.toStopId)
                const keepTo = route.anyOrder ? leg.draft.toStopId !== id : toIdx > nextFromIdx
                onChange({ fromStopId: id, toStopId: keepTo ? leg.draft.toStopId : undefined })
              }}
            />
            <StopSelect label="İniş durağı" value={to?.id} options={toOptions} loading={!dir} disabled={!from} onChange={(id) => onChange({ toStopId: id })} />
          </div>
        )}

        {leg.complete && <LegOutcome leg={leg} result={result} />}
      </div>
    </li>
  )
}

function LegOutcome({ leg, result }: { leg: ResolvedLeg; result: LegResult | undefined }) {
  const rule = leg.tariff ? TARIFFS[leg.tariff] : undefined
  if (leg.quoteState?.error) {
    return <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">{leg.quoteState.error}</p>
  }
  if (!result || result.status === 'pending') {
    return <div className="h-12 animate-pulse rounded-md bg-[var(--track)]" aria-label="Ücret hesaplanıyor" />
  }

  const free = result.status === 'transfer'
  const remaining = result.window ? Math.max(0, result.window.endMin - leg.boardMin) : null
  const blocked = rule?.distanceBased

  return (
    <div className="rounded-lg bg-[var(--bg)] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={result.status} />
          {result.halkTasit && <Badge tone="good">Halk Taşıt</Badge>}
          {result.window?.openedHere && <Badge tone="info">90 dk başladı</Badge>}
          {leg.quoteState?.km !== undefined && <span className="text-xs text-[var(--muted)]">{leg.quoteState.km.toLocaleString('tr-TR')} km</span>}
        </div>
        <div className="text-right">
          <div className={`font-display text-2xl font-bold leading-none tabular-nums ${free ? 'text-[var(--good)]' : 'text-[var(--ink)]'}`}>
            {free ? 'Ücretsiz' : tl(result.charged)}
          </div>
          {result.charged !== result.fullFare && <div className="text-xs text-[var(--muted)] line-through tabular-nums">{tl(result.fullFare)}</div>}
        </div>
      </div>

      {blocked && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Binişte bloke</dt>
            <dd className="font-semibold tabular-nums">{tl(result.deductedAtBoard)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">İnişte iade</dt>
            <dd className="font-semibold tabular-nums text-[var(--good)]">{tl(result.refund)}</dd>
          </div>
        </dl>
      )}

      {remaining !== null && (
        <div className="mt-2">
          <div className="flex justify-between text-[11px] text-[var(--muted)]">
            <span>Aktarma süresi</span>
            <span className="tabular-nums">{remaining} dk kaldı · {fmtMin(result.window!.endMin)}'e kadar</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
            <div className="h-full rounded-full bg-[var(--good)]" style={{ width: `${(remaining / 90) * 100}%` }} />
          </div>
        </div>
      )}

      {result.notes.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {result.notes
            .filter((n) => !n.text.startsWith('Halk Taşıt'))
            .map((n, i) => (
              <li key={i} className={`text-xs ${n.tone === 'warn' ? 'text-[var(--warn)]' : n.tone === 'good' ? 'text-[var(--good)]' : 'text-[var(--muted)]'}`}>
                {n.tone === 'warn' ? '⚠ ' : '• '}
                {n.text}
              </li>
            ))}
        </ul>
      )}

      {result.balanceAfterAlight !== undefined && (
        <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-1.5 text-xs">
          <span className="text-[var(--muted)]">Kart bakiyesi</span>
          <span className={`font-semibold tabular-nums ${result.insufficient ? 'text-[var(--warn)]' : 'text-[var(--ink)]'}`}>
            {blocked ? `${tl(result.balanceAfterBoard!)} → ${tl(result.balanceAfterAlight)}` : tl(result.balanceAfterAlight)}
          </span>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: LegResult['status'] }) {
  if (status === 'transfer') return <Badge tone="good">Aktarma</Badge>
  if (status === 'transfer-partial') return <Badge tone="good">Aktarma · kısmi</Badge>
  return <Badge tone="neutral">Ücretli biniş</Badge>
}

function Badge({ tone, children }: { tone: 'good' | 'info' | 'neutral'; children: React.ReactNode }) {
  const cls =
    tone === 'good'
      ? 'bg-[var(--good-soft)] text-[var(--good)]'
      : tone === 'info'
        ? 'bg-[var(--info-soft)] text-[var(--info)]'
        : 'bg-[var(--track)] text-[var(--muted)]'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>
}

function StopSelect({
  label,
  value,
  options,
  loading,
  disabled,
  onChange,
}: {
  label: string
  value: string | undefined
  options: { id: string; name: string }[]
  loading: boolean
  disabled?: boolean
  onChange: (id: string) => void
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
      {label}
      <select
        value={value ?? ''}
        disabled={loading || disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1.5 text-sm font-medium normal-case tracking-normal text-[var(--ink)] disabled:opacity-50"
      >
        <option value="">{loading ? 'Yükleniyor…' : 'Seçin'}</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded text-sm text-[var(--muted)] hover:bg-[var(--track)] hover:text-[var(--ink)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
