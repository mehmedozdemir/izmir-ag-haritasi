import type { SimulationResult } from '../../fare/engine'
import { cardMeta } from '../../fare/tariffs'
import type { Journey } from '../../sim/journey'
import { legStats } from '../../sim/legOps'
import { CardTag } from './CardTag'
import { tl } from './LegCard'

/**
 * Biniş listesi başlığı: solda başlık, kart tipi ve kısa döküm; sağda yolculuğun toplam ücreti
 * büyük ve belirgin (kart tipinin renginde vurgulu), altında aktarma tasarrufu.
 */
export function LegTotalsHeader({ journey, detail, onClear }: { journey: Journey; detail: SimulationResult; onClear: () => void }) {
  const st = legStats(journey, detail)
  const { color } = cardMeta(journey.detailCard)

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Binişler</h2>
          <CardTag card={journey.detailCard} suffix=" kart" className="text-xs" />
        </div>
        <p className="text-xs tabular-nums text-[var(--muted)]">
          {st.count === 0 ? (
            'Henüz biniş yok'
          ) : (
            <>
              {st.count} biniş · {st.paid} ücretli · {st.transfers} aktarma
              {st.count > 0 && (
                <>
                  {' · '}
                  <button type="button" onClick={onClear} className="font-semibold hover:text-[var(--warn)] hover:underline">
                    Temizle
                  </button>
                </>
              )}
            </>
          )}
        </p>
      </div>

      {st.count > 0 && (
        <div
          className="flex shrink-0 flex-col items-end justify-center rounded-lg px-3 py-1"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, boxShadow: `inset 3px 0 0 ${color}` }}
          aria-label={`Toplam ${st.total === null ? 'hesaplanıyor' : tl(st.total)}`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Toplam</span>
          <span className="font-display text-2xl leading-none font-bold tabular-nums text-[var(--ink)]">{st.total === null ? '…' : tl(st.total)}</span>
          {st.saved !== null && st.saved > 0 && (
            <span className="mt-0.5 text-[10px] font-semibold text-[var(--good)]">{tl(st.saved)} aktarma tasarrufu</span>
          )}
        </div>
      )}
    </div>
  )
}
