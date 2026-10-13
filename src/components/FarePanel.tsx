import { useState } from 'react'
import type { FareItem, FareResult } from '../api'
import { izbanStations, stopsBetween } from '../network'

type Props = {
  fromId: number | null
  toId: number | null
  date: string
  onFromChange: (id: number | null) => void
  onToChange: (id: number | null) => void
  onSwap: () => void
  onClear: () => void
  onDateChange: (date: string) => void
  fare: FareResult | undefined
  isLoading: boolean
  error: Error | null
}

const CARD_KEY = 'izmir-ag.cardType'

function readCardType(): FareItem['type'] {
  try {
    return (localStorage.getItem(CARD_KEY) as FareItem['type'] | null) ?? 'tam'
  } catch {
    return 'tam'
  }
}

const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const km = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })

export function FarePanel(props: Props) {
  const { fromId, toId, date, fare, isLoading, error } = props
  const [cardType, setCardType] = useState(readCardType)

  const chooseCard = (type: FareItem['type']) => {
    setCardType(type)
    try {
      localStorage.setItem(CARD_KEY, type)
    } catch {
      /* depolama kapalıysa tercih yalnızca bu oturumda kalır */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Güzergah" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <Dot kind="from" />
          <StationSelect label="Biniş istasyonu" value={fromId} disabledId={toId} onChange={props.onFromChange} />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={props.onSwap}
              disabled={fromId === null && toId === null}
              title="Yönü değiştir"
              aria-label="Biniş ve iniş istasyonlarını yer değiştir"
              className="grid h-7 w-7 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              ⇅
            </button>
          </div>
          <div className="h-px bg-[var(--line)]" />
          <Dot kind="to" />
          <StationSelect label="İniş istasyonu" value={toId} disabledId={fromId} onChange={props.onToChange} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            Tarih
            <input
              type="date"
              value={date}
              onChange={(e) => props.onDateChange(e.target.value)}
              className="rounded-md border border-[var(--line)] bg-transparent px-2 py-1 text-sm text-[var(--ink)]"
            />
          </label>
          {(fromId !== null || toId !== null) && (
            <button type="button" onClick={props.onClear} className="text-sm font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline">
              Temizle
            </button>
          )}
        </div>
      </section>

      {fromId === null || toId === null ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm leading-relaxed text-[var(--muted)]">
          Haritada bir <strong className="text-[var(--izban)]">İZBAN</strong> durağına tıklayın: ilk tıklama <strong>biniş</strong>, ikincisi{' '}
          <strong>iniş</strong> istasyonunu seçer. Listeden de seçebilirsiniz.
        </p>
      ) : error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error.message}
        </p>
      ) : isLoading || !fare ? (
        <FareSkeleton />
      ) : (
        <FareResultView fare={fare} stops={stopsBetween(fromId, toId)} cardType={cardType} onCardType={chooseCard} />
      )}

      <footer className="mt-auto space-y-2 text-xs leading-relaxed text-[var(--muted)]">
        <p>
          <span className="mr-1 inline-block h-2 w-4 rounded-full bg-[var(--metro)] align-middle" />
          Metro M1 ücreti mesafeden bağımsız, sabit tarifelidir. Halkapınar ve Hilal'de İZBAN ile aktarma yapılır.
        </p>
        <p>Ücretler tarife.izmirimkart.com.tr üzerinden alınır, bilgilendirme amaçlıdır.</p>
      </footer>
    </div>
  )
}

function FareResultView({
  fare,
  stops,
  cardType,
  onCardType,
}: {
  fare: FareResult
  stops: number
  cardType: FareItem['type']
  onCardType: (t: FareItem['type']) => void
}) {
  const selected = fare.fares.find((f) => f.type === cardType) ?? fare.fares[0]

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Yolculuk özeti" className="grid grid-cols-2 gap-2">
        <Stat label="Mesafe" value={`${km(fare.km)} km`} />
        <Stat label="Durak" value={`${stops} durak`} />
      </section>

      <section aria-label="Kart tipine göre net ücret">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Kart tipin · net ücret</h2>
        <div className="grid grid-cols-2 gap-1.5">
          {fare.fares.map((f) => {
            const active = f.type === selected.type
            const { label, color } = CARD_LOOK[f.type]
            return (
              <button
                key={f.type}
                type="button"
                onClick={() => onCardType(f.type)}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-2 text-left transition ${f.type === 'serbest' ? 'col-span-2' : ''} ${
                  active ? 'border-transparent' : 'border-[var(--line)] hover:border-[var(--muted)]'
                }`}
                style={active ? { boxShadow: `inset 0 0 0 2px ${color}`, background: `color-mix(in srgb, ${color} 12%, var(--surface))` } : undefined}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-[var(--ink)]">{amount(f, f.price)}</span>
              </button>
            )
          })}
        </div>
      </section>

      <PaymentSteps fare={selected} />
    </div>
  )
}

/** Kart tipi görünümü (simülasyondaki kart renkleriyle aynı). */
const CARD_LOOK: Record<FareItem['type'], { label: string; color: string }> = {
  tam: { label: 'Tam', color: 'var(--card-tam)' },
  ogrenci: { label: 'Genç (Öğrenci)', color: 'var(--card-genc)' },
  ogretmen: { label: 'Öğretmen', color: 'var(--card-ogretmen)' },
  yas60: { label: '60 Yaş', color: 'var(--card-yas60)' },
  serbest: { label: 'Serbest (kontörlü)', color: 'var(--muted)' },
}

const amount = (f: FareItem, n: number) => (f.unit === 'TL' ? `${tl(n)} TL` : `${n} kontör`)

/**
 * Seçili kartla ödeme adımları: binişte düşen (bloke) tutar, inişte iade ve net ücret.
 * İZBAN'da binişte hattın sonuna kadarki ücret bloke edilir; inişte okutulunca fark geri yüklenir.
 */
function PaymentSteps({ fare }: { fare: FareItem }) {
  const { label, color } = CARD_LOOK[fare.type]
  const hasRefund = fare.refund > 0
  const paidPct = fare.minBalance > 0 ? (fare.price / fare.minBalance) * 100 : 100

  return (
    <section aria-label="Ödeme adımları" className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <header className="flex items-center justify-between gap-3 px-4 pt-3" style={{ borderTop: `3px solid ${color}` }}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          <span style={{ color }}>{label}</span> kart ile ödeme
        </h2>
      </header>

      <ol className="mt-2 px-4">
        <Step
          n={1}
          tone="out"
          title="Binişte (turnikede)"
          text={hasRefund ? 'Kartından düşülür (bloke edilir)' : 'Kartından düşülür'}
          value={`−${amount(fare, fare.minBalance)}`}
        />
        {hasRefund && (
          <Step n={2} tone="in" title="İnişte (iade cihazında)" text="Kartına geri yüklenir" value={`+${amount(fare, fare.refund)}`} />
        )}
      </ol>

      <div className="mx-4 mt-1 flex items-baseline justify-between border-t-2 border-[var(--ink)]/20 py-3">
        <span className="text-sm font-semibold text-[var(--ink)]">= Net yolculuk ücreti</span>
        <span className="font-display text-3xl font-bold tabular-nums text-[var(--ink)]">{amount(fare, fare.price)}</span>
      </div>

      {hasRefund && (
        <div className="px-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--track)]" role="img" aria-label={`Binişte düşen ${amount(fare, fare.minBalance)}: ${amount(fare, fare.price)} ücret, ${amount(fare, fare.refund)} iade`}>
            <div className="h-full bg-[var(--izban)]" style={{ width: `${paidPct}%` }} />
            <div className="h-full bg-[var(--refund)]" style={{ width: `${100 - paidPct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--izban)]" /> Ücret
            </span>
            <span className="flex items-center gap-1">
              İade <span className="h-2 w-2 rounded-full bg-[var(--refund)]" />
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1.5 bg-[var(--bg)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
        <p>
          💳 Binişte kartında en az <strong className="text-[var(--ink)]">{amount(fare, fare.minBalance)}</strong> bulunmalı.
        </p>
        {hasRefund ? (
          <p>
            ⚠ İnişte kartını iade cihazına okutmazsan iade alamazsın; bu yolculuk <strong className="text-[var(--warn)]">{amount(fare, fare.minBalance)}</strong>{' '}
            tutar.
          </p>
        ) : (
          <p>Bu yolculukta iade yok: binişte düşen tutar ücretin tamamıdır.</p>
        )}
      </div>
    </section>
  )
}

function Step({ n, tone, title, text, value }: { n: number; tone: 'out' | 'in'; title: string; text: string; value: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${tone === 'out' ? 'bg-[var(--izban)]/15 text-[var(--izban)]' : 'bg-[var(--good-soft)] text-[var(--good)]'}`}
      >
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--ink)]">{title}</span>
        <span className="block text-xs text-[var(--muted)]">{text}</span>
      </span>
      <span className={`font-display text-lg font-bold tabular-nums ${tone === 'out' ? 'text-[var(--ink)]' : 'text-[var(--good)]'}`}>{value}</span>
    </li>
  )
}

function StationSelect({
  label,
  value,
  disabledId,
  onChange,
}: {
  label: string
  value: number | null
  disabledId: number | null
  onChange: (id: number | null) => void
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="w-full rounded-md bg-transparent py-1 text-base font-semibold text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--izban)]"
    >
      <option value="">{label} seçin</option>
      {izbanStations.map((s) => (
        <option key={s.tarifeId} value={s.tarifeId} disabled={s.tarifeId === disabledId}>
          {s.name}
        </option>
      ))}
    </select>
  )
}

function Dot({ kind }: { kind: 'from' | 'to' }) {
  return (
    <span
      aria-hidden
      className={`block h-3.5 w-3.5 rounded-full border-[3px] bg-white ${kind === 'from' ? 'border-[var(--from)]' : 'border-[var(--ink)]'}`}
    />
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="font-display text-xl font-bold tabular-nums text-[var(--ink)]">{value}</div>
    </div>
  )
}

function FareSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-2" aria-busy="true" aria-label="Ücret yükleniyor">
      <div className="h-14 rounded-xl bg-[var(--track)]" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-12 rounded-lg bg-[var(--track)]" />
      ))}
    </div>
  )
}
