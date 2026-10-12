import type { SimulationResult } from '../../fare/engine'
import { CARD_TYPES, TARIFF_VALID_FROM, type CardType } from '../../fare/tariffs'
import type { RouteInfo } from '../../transit/data'
import type { Journey } from '../../sim/journey'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { tl } from './LegCard'
import { LegList } from './LegList'

type Props = {
  journey: Journey
  onJourney: (j: Journey) => void
  routes: RouteInfo[] | undefined
  routesError: Error | null
  resolved: ResolvedLeg[]
  results: Record<CardType, SimulationResult>
  /** Geniş ekranda binişler harita üzerinde gösterilir; panelde yalnızca ayarlar ve özet kalır. */
  legsOnMap: boolean
  activeId: string | null
  onActive: (id: string | null) => void
}

export function SimPanel({ journey, onJourney, routes, routesError, resolved, results, legsOnMap, activeId, onActive }: Props) {
  const set = (patch: Partial<Journey>) => onJourney({ ...journey, ...patch })

  const detail = results[journey.detailCard]
  const completeCount = resolved.filter((l) => l.complete).length

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Ayarlar" className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
        <Field label="Tarih">
          <input type="date" value={journey.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className="input" />
        </Field>
        <Field label="İlk biniş saati">
          <input type="time" value={journey.startTime} onChange={(e) => e.target.value && set({ startTime: e.target.value })} className="input" />
        </Field>
        <Field label="Aktarma süresi (dk)" hint="İnişten sonraki binişe kadar yürüme/bekleme">
          <input
            type="number"
            min={0}
            max={120}
            value={journey.transferBufferMin}
            onChange={(e) => set({ transferBufferMin: Math.max(0, Number(e.target.value) || 0) })}
            className="input"
          />
        </Field>
        <Field label="Başlangıç bakiyesi (TL)" hint="Boş bırakılırsa takip edilmez">
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="—"
            value={journey.startBalance ?? ''}
            onChange={(e) => set({ startBalance: e.target.value === '' ? null : Number(e.target.value) })}
            className="input"
          />
        </Field>
        <label className="col-span-2 flex cursor-pointer items-start gap-2 rounded-lg bg-[var(--bg)] p-2">
          <input
            type="checkbox"
            checked={journey.settings.izbanTransfer}
            onChange={(e) => set({ settings: { ...journey.settings, izbanTransfer: e.target.checked } })}
            className="mt-0.5 h-4 w-4 accent-[var(--izban)]"
          />
          <span>
            <span className="font-semibold text-[var(--ink)]">İZBAN aktarmaya dahil</span>
            <span className="block text-xs text-[var(--muted)]">
              Açıkken 90 dk içinde İZBAN'da ilk 20 km ücreti ödenmiş sayılır, blokajın kalanı inişte iade edilir. Kapalıyken İZBAN her binişte tam ücretlenir.
            </span>
          </span>
        </label>
      </section>

      {completeCount > 0 && (
        <section aria-label="Kart tiplerine göre toplam">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Toplam yolculuk maliyeti</h2>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {CARD_TYPES.map(({ type, label }) => {
              const r = results[type]
              const active = type === journey.detailCard
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ detailCard: type })}
                  className={`rounded-lg border px-2 py-2 text-left transition ${active ? 'border-[var(--ink)] bg-[var(--surface)]' : 'border-[var(--line)] hover:border-[var(--muted)]'}`}
                >
                  <div className="text-[11px] font-semibold text-[var(--muted)]">{label}</div>
                  <div className="font-display text-lg font-bold leading-tight tabular-nums text-[var(--ink)]">
                    {r.total === null ? '…' : tl(r.total)}
                  </div>
                  {r.saved !== null && r.saved > 0 && <div className="text-[10px] font-semibold text-[var(--good)]">{tl(r.saved)} tasarruf</div>}
                </button>
              )
            })}
          </div>
          {detail.endBalance !== undefined && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Yolculuk sonunda kart bakiyesi ({CARD_TYPES.find((c) => c.type === journey.detailCard)!.label}):{' '}
              <strong className={detail.endBalance < 0 ? 'text-[var(--warn)]' : 'text-[var(--ink)]'}>{tl(detail.endBalance)}</strong>
            </p>
          )}
        </section>
      )}

      {legsOnMap ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] p-3 text-xs leading-relaxed text-[var(--muted)]">
          Binişler harita üzerinde. Bir kartı düzenlemek için tıklayın; kartın dışına tıklayınca ya da Esc ile kapanır. Kartların yerini haritanın
          üstündeki düğmelerle değiştirebilirsiniz.
        </p>
      ) : (
        <LegList
          layout="sidebar"
          journey={journey}
          onJourney={onJourney}
          routes={routes}
          routesError={routesError}
          resolved={resolved}
          detail={detail}
          activeId={activeId}
          onActive={onActive}
        />
      )}

      <footer className="space-y-1.5 text-xs leading-relaxed text-[var(--muted)]">
        <p>
          Tarife: İzmir BB {TARIFF_VALID_FROM.split('-').reverse().join('.')} tarihli fiyat tarifesi. İZBAN ve "Gittiğin Kadar Öde" hatlarının ücretleri
          resmi hesaplama servislerinden alınır.
        </p>
        <p>
          Varsayımlar: Aktarma hakkı olmayan hatlar 90 dk süresini etkilemez. Seyahat süreleri tarifeli sefer saatlerinin ortalamasıdır; durakta
          bekleme dahil değildir, saatleri elle düzeltebilirsiniz. Sonuçlar bilgilendirme amaçlıdır.
        </p>
      </footer>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5" title={hint}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      {children}
    </label>
  )
}
