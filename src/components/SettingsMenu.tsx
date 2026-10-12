import { useEffect, useRef, useState } from 'react'
import { CARD_SCALE } from '../sim/cardScale'

type Props = {
  scale: number
  onIncrease: () => void
  onDecrease: () => void
  onReset: () => void
}

/** ⚙ düğmesiyle açılan görünüm ayarları; şimdilik biniş kartı boyutu. */
export function SettingsMenu({ scale, onIncrease, onDecrease, onReset }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pct = Math.round(scale * 100)
  const stepBtn =
    'grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] text-lg font-bold text-[var(--ink)] hover:border-[var(--ink)] disabled:opacity-30 disabled:hover:border-[var(--line)]'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Görünüm ayarları"
        title="Görünüm ayarları"
        className={`grid h-9 w-9 place-items-center rounded-full text-base shadow-sm backdrop-blur transition ${open ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--bg)]/90 text-[var(--ink)] hover:bg-[var(--surface)]'}`}
      >
        ⚙
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Görünüm ayarları"
          className="absolute top-full right-0 z-[1000] mt-2 w-64 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm shadow-lg"
        >
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Görünüm ayarları</h3>

          <div className="mt-3">
            <div className="font-semibold text-[var(--ink)]">Biniş kartı boyutu</div>
            <p className="text-xs text-[var(--muted)]">Genişlik, yükseklik ve yazı birlikte büyür/küçülür.</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={onDecrease} disabled={scale <= CARD_SCALE.min} aria-label="Küçült" className={stepBtn}>
                −
              </button>
              <div className="flex-1 text-center">
                <div className="font-display text-xl font-bold tabular-nums text-[var(--ink)]">%{pct}</div>
                <div className="mx-auto mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--track)]">
                  <div
                    className="h-full rounded-full bg-[var(--ink)]"
                    style={{ width: `${((scale - CARD_SCALE.min) / (CARD_SCALE.max - CARD_SCALE.min)) * 100}%` }}
                  />
                </div>
              </div>
              <button type="button" onClick={onIncrease} disabled={scale >= CARD_SCALE.max} aria-label="Büyüt" className={stepBtn}>
                +
              </button>
            </div>
            <button
              type="button"
              onClick={onReset}
              disabled={scale === CARD_SCALE.default}
              className="mt-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              Varsayılana dön (%{Math.round(CARD_SCALE.default * 100)})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
