import type { SimulationResult } from '../../fare/engine'
import { CARD_TYPES, TARIFF_VALID_FROM, type CardType } from '../../fare/tariffs'
import { scenarioName, type Scenario } from '../../sim/scenarios'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { tl } from './LegCard'

type Props = {
  scenario: Scenario | undefined
  scenarioCount: number
  onCardChange: (card: CardType) => void
  onClearAll: () => void
  resolved: ResolvedLeg[]
  results: Record<CardType, SimulationResult>
  /** Dar ekranda senaryo şeridi ve binişler panelde gösterilir; geniş ekranda harita üzerindedir. */
  workspace: React.ReactNode | null
  /** Binişler panelde değilken gösterilecek açıklama (varsayılan: harita üzerinde). */
  hint?: string
}

const trDate = (iso: string) => iso.split('-').reverse().join('.')

export function SimPanel({ scenario, scenarioCount, onCardChange, onClearAll, resolved, results, workspace, hint }: Props) {
  const completeCount = resolved.filter((l) => l.complete).length
  const detail = scenario ? results[scenario.detailCard] : undefined

  return (
    <div className="flex flex-col gap-4">
      {scenario ? (
        <section aria-label="Senaryo özeti" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <h2 className="truncate font-display text-xl font-bold leading-tight text-[var(--ink)]">{scenarioName(scenario)}</h2>
          <p className="text-xs tabular-nums text-[var(--muted)]">
            {trDate(scenario.date)} · ilk biniş {scenario.startTime} · {scenario.legs.length} biniş
            {scenario.startBalance !== null && ` · başlangıç bakiyesi ${tl(scenario.startBalance)}`}
            {!scenario.settings.izbanTransfer && ' · İZBAN aktarması kapalı'}
          </p>

          {completeCount > 0 && detail && (
            <>
              <h3 className="mt-3 mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Kart tipine göre toplam</h3>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {CARD_TYPES.map(({ type, label }) => {
                  const r = results[type]
                  const active = type === scenario.detailCard
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onCardChange(type)}
                      title={active ? 'Senaryonun kart tipi' : 'Senaryonun kart tipini bu yap'}
                      className={`rounded-lg border px-2 py-2 text-left transition ${active ? 'border-[var(--ink)] bg-[var(--bg)]' : 'border-[var(--line)] hover:border-[var(--muted)]'}`}
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
                  Yolculuk sonunda kart bakiyesi:{' '}
                  <strong className={detail.endBalance < 0 ? 'text-[var(--warn)]' : 'text-[var(--ink)]'}>{tl(detail.endBalance)}</strong>
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        !workspace && (
          <p className="rounded-xl border border-dashed border-[var(--line)] p-3 text-sm leading-relaxed text-[var(--muted)]">
            <strong className="text-[var(--ink)]">＋ Yeni senaryo</strong> ile bir ücret senaryosu oluşturun, ardından binişleri sırayla
            ekleyin.
          </p>
        )
      )}

      {workspace ?? (
        <p className="rounded-xl border border-dashed border-[var(--line)] p-3 text-xs leading-relaxed text-[var(--muted)]">
          {hint ?? <>Senaryolar ve binişler harita üzerinde. Bir kartı düzenlemek için tıklayın; seçili senaryoya tekrar tıklayınca bilgileri açılır. Kartın dışına
          tıklayınca ya da Esc ile kapanır. Kartların yerini haritanın üstündeki düğmelerle değiştirebilirsiniz.</>}
        </p>
      )}

      <footer className="space-y-1.5 text-xs leading-relaxed text-[var(--muted)]">
        <p>
          Tarife: İzmir BB {trDate(TARIFF_VALID_FROM)} tarihli fiyat tarifesi. İZBAN ve "Gittiğin Kadar Öde" hatlarının ücretleri resmi hesaplama
          servislerinden alınır.
        </p>
        <p>
          Varsayımlar: Aktarma hakkı olmayan hatlar 90 dk süresini etkilemez. Seyahat süreleri tarifeli sefer saatlerinin ortalamasıdır; durakta bekleme
          dahil değildir, saatleri elle düzeltebilirsiniz. Sonuçlar bilgilendirme amaçlıdır.
        </p>
        <p>Senaryolar yalnızca bu tarayıcıda saklanır.</p>
        {scenarioCount > 0 && (
          <button
            type="button"
            onClick={() => window.confirm(`${scenarioCount} senaryonun tamamı ve binişleri silinsin mi? Bu işlem geri alınamaz.`) && onClearAll()}
            className="font-semibold text-[var(--warn)] hover:underline"
          >
            Tüm senaryoları sil
          </button>
        )}
      </footer>
    </div>
  )
}
