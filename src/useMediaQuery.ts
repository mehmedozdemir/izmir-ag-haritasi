import { useSyncExternalStore } from 'react'

/** CSS medya sorgusunun anlık sonucunu döndürür ve değişince yeniden render eder. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      // Bazı ortamlarda (cihaz/viewport emülasyonu) 'change' tetiklenmeyebiliyor; resize ile de denetle.
      window.addEventListener('resize', onChange)
      return () => {
        mql.removeEventListener('change', onChange)
        window.removeEventListener('resize', onChange)
      }
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
