import { useState } from 'react'

// Biniş kartlarının boyutu: genişlik, yükseklik ve yazı birlikte (CSS zoom) ölçeklenir.
const KEY = 'izmir-ag.cardScale'
export const CARD_SCALE = { min: 0.8, max: 1.6, step: 0.1, default: 1.15 }

const clamp = (v: number) => Math.min(CARD_SCALE.max, Math.max(CARD_SCALE.min, Math.round(v * 100) / 100))

function load(): number {
  try {
    const v = Number(localStorage.getItem(KEY))
    return v ? clamp(v) : CARD_SCALE.default
  } catch {
    return CARD_SCALE.default
  }
}

export function useCardScale() {
  const [scale, setScaleState] = useState(load)
  const setScale = (v: number) => {
    const next = clamp(v)
    setScaleState(next)
    try {
      localStorage.setItem(KEY, String(next))
    } catch {
      /* depolama kapalıysa ayar yalnızca bu oturumda kalır */
    }
  }
  return {
    scale,
    increase: () => setScale(scale + CARD_SCALE.step),
    decrease: () => setScale(scale - CARD_SCALE.step),
    reset: () => setScale(CARD_SCALE.default),
  }
}
