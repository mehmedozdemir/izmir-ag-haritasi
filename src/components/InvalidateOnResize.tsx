import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * Leaflet yalnızca pencere boyutu değişince kendini yeniler; kapsayıcı (ör. sağ panel açılıp kapanınca)
 * değiştiğinde de haritayı yeniden ölçer. Aksi hâlde yeni açılan alanda gri boşluk kalır.
 */
export function InvalidateOnResize() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}
