import { cardMeta, type CardType } from '../../fare/tariffs'

/** Kart tipi etiketi: kendi renginde yazı, rengin hafif tonunda zemin (açık/koyu temada okunur). */
export function CardTag({ card, suffix = '', className = '' }: { card: CardType; suffix?: string; className?: string }) {
  const { label, color } = cardMeta(card)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[0.92em] font-semibold whitespace-nowrap ${className}`}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
      {suffix}
    </span>
  )
}

/** Yalnızca renk noktası (dar alanlar ve select yanı için). */
export function CardDot({ card, className = '' }: { card: CardType; className?: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{ background: cardMeta(card).color }} />
}
