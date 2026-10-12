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
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">İzmir Raylı Sistem</p>
        <h1 className="font-display text-3xl font-bold leading-none text-[var(--ink)]">İZBAN Ücret Haritası</h1>
      </header>

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
  const tlFares = fare.fares.filter((f) => f.unit === 'TL')
  const credit = fare.fares.find((f) => f.unit === 'kontör')
  const max = Math.max(...tlFares.map((f) => f.price))
  const selected = fare.fares.find((f) => f.type === cardType) ?? fare.fares[0]

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Yolculuk özeti" className="grid grid-cols-2 gap-2">
        <Stat label="Mesafe" value={`${km(fare.km)} km`} />
        <Stat label="Durak" value={`${stops} durak`} />
      </section>

      <section aria-label="Kart tiplerine göre ücret">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Kart tipine göre ücret</h2>
        <ul className="flex flex-col gap-1.5">
          {tlFares.map((f) => {
            const active = f.type === selected.type
            return (
              <li key={f.type}>
                <button
                  type="button"
                  onClick={() => onCardType(f.type)}
                  aria-pressed={active}
                  className={`group w-full rounded-lg border px-3 py-2 text-left transition ${
                    active ? 'border-[var(--ink)] bg-[var(--surface)]' : 'border-transparent hover:bg-[var(--surface)]'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`text-sm ${active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--muted)]'}`}>{f.label}</span>
                    <span className="font-display text-xl font-bold tabular-nums text-[var(--ink)]">
                      {tl(f.price)} <span className="text-sm font-semibold text-[var(--muted)]">TL</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--track)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${(f.price / max) * 100}%`, background: active ? 'var(--izban)' : 'var(--bar)' }}
                    />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
        {credit && (
          <button
            type="button"
            onClick={() => onCardType(credit.type)}
            aria-pressed={selected.type === credit.type}
            className={`mt-1.5 flex w-full items-baseline justify-between rounded-lg border px-3 py-2 text-left transition ${
              selected.type === credit.type ? 'border-[var(--ink)] bg-[var(--surface)]' : 'border-transparent hover:bg-[var(--surface)]'
            }`}
          >
            <span className="text-sm text-[var(--muted)]">{credit.label} (kontörlü)</span>
            <span className="font-display text-xl font-bold tabular-nums text-[var(--ink)]">
              {credit.price} <span className="text-sm font-semibold text-[var(--muted)]">kontör</span>
            </span>
          </button>
        )}
      </section>

      <BalanceBreakdown fare={selected} />
    </div>
  )
}

/** Binişte bloke edilen tutarın ne kadarının ödendiğini, ne kadarının inişte iade edildiğini gösterir. */
function BalanceBreakdown({ fare }: { fare: FareItem }) {
  const fmt = (n: number) => (fare.unit === 'TL' ? `${tl(n)} TL` : `${n} kontör`)
  const paidPct = fare.minBalance > 0 ? (fare.price / fare.minBalance) * 100 : 100

  return (
    <section aria-label="Kart bakiyesi" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{fare.label} kart · binişte gereken bakiye</h2>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums text-[var(--ink)]">{fmt(fare.minBalance)}</p>

      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--track)]" role="img" aria-label={`Ödenen ${fmt(fare.price)}, iade ${fmt(fare.refund)}`}>
        <div className="h-full bg-[var(--izban)]" style={{ width: `${paidPct}%` }} />
        {fare.refund > 0 && <div className="h-full bg-[var(--refund)]" style={{ width: `${100 - paidPct}%` }} />}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--izban)]" /> Ödenen
          </dt>
          <dd className="font-semibold tabular-nums text-[var(--ink)]">{fmt(fare.price)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--refund)]" /> İnişte iade
          </dt>
          <dd className="font-semibold tabular-nums text-[var(--ink)]">{fmt(fare.refund)}</dd>
        </div>
      </dl>
      {fare.refund > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
          Binişte bu tutar kartınızda bloke edilir; iniş istasyonunda kartınızı okuttuğunuzda fark iade edilir. Çıkışta okutmazsanız iade alamazsınız.
        </p>
      )}
    </section>
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
