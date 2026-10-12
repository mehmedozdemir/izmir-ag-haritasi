import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Pane, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { divIcon, latLngBounds, point, type PointExpression } from 'leaflet'
import { lines, stations } from '../../network'
import { shapeBetween } from '../../transit/data'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { TILE_ATTRIBUTION, TILE_URL } from '../NetworkMap'

const IZMIR_BOUNDS = latLngBounds(stations.map((s) => [s.lat, s.lng]))

/** Haritanın üzerini kaplayan kartlar için yakınlaştırmada bırakılacak kenar boşlukları (px). */
export type FitPadding = { topLeft: PointExpression; bottomRight: PointExpression }

type Props = {
  legs: ResolvedLeg[]
  activeId: string | null
  onSelect: (legId: string) => void
  fitPadding: FitPadding
}

export function SimMap({ legs, activeId, onSelect, fitPadding }: Props) {
  const drawn = useMemo(
    () =>
      legs
        .map((l, i) => ({ leg: l, n: i + 1 }))
        .filter(({ leg }) => leg.complete && leg.dir)
        .map(({ leg, n }) => ({
          n,
          leg,
          path: leg.route!.anyOrder
            ? ([[leg.from!.lat, leg.from!.lng], [leg.to!.lat, leg.to!.lng]] as [number, number][])
            : shapeBetween(leg.dir!, leg.from!, leg.to!),
        })),
    [legs],
  )

  // Düzenlenen biniş varsa ona odaklan, diğerlerini soluklaştır.
  const focused = drawn.find((d) => d.leg.draft.id === activeId)
  const dim = (id: string) => (focused && focused.leg.draft.id !== id ? 0.35 : 1)

  return (
    <MapContainer bounds={IZMIR_BOUNDS} boundsOptions={{ padding: [24, 24] }} zoomControl={false} className="h-full w-full">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} className="basemap" />
      <FitTo paths={focused ? [focused.path] : drawn.map((d) => d.path)} padding={fitPadding} />

      {/* Bağlam için raylı ağ soluk olarak */}
      <Pane name="context" style={{ zIndex: 405 }}>
        {lines.map((l) => (
          <Polyline key={l.id} positions={l.coords} pathOptions={{ color: l.color, weight: 3, opacity: 0.18 }} interactive={false} />
        ))}
      </Pane>

      <Pane name="legs" style={{ zIndex: 410 }}>
        {drawn.map(({ leg, path }) => (
          <Polyline
            key={`${leg.draft.id}-casing`}
            positions={path}
            pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9 * dim(leg.draft.id) }}
            interactive={false}
          />
        ))}
        {drawn.map(({ leg, path }) => (
          <Polyline
            key={leg.draft.id}
            positions={path}
            pathOptions={{
              color: leg.route!.color,
              weight: leg.draft.id === activeId ? 8 : 6,
              opacity: dim(leg.draft.id),
              dashArray: leg.route!.mode === 'ferry' ? '2 10' : undefined,
              lineCap: 'round',
            }}
            eventHandlers={{ click: () => onSelect(leg.draft.id) }}
          >
            <Tooltip sticky>{`${leg.route!.ref || leg.route!.name}: ${leg.from!.name} → ${leg.to!.name}`}</Tooltip>
          </Polyline>
        ))}
      </Pane>

      <Pane name="leg-stops" style={{ zIndex: 420 }}>
        {drawn.map(({ leg }) => (
          <CircleMarker
            key={`${leg.draft.id}-to`}
            center={[leg.to!.lat, leg.to!.lng]}
            radius={5}
            pathOptions={{ color: leg.route!.color, weight: 3, fillColor: '#fff', fillOpacity: 1, opacity: dim(leg.draft.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]} className="station-tip">
              <span>{leg.to!.name}</span>
              <span className="station-tip__meta">İniş</span>
            </Tooltip>
          </CircleMarker>
        ))}
        {drawn.map(({ n, leg }) => (
          <Marker
            key={`${leg.draft.id}-from`}
            position={[leg.from!.lat, leg.from!.lng]}
            opacity={dim(leg.draft.id)}
            zIndexOffset={leg.draft.id === activeId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(leg.draft.id) }}
            icon={divIcon({
              className: '',
              html: `<span class="leg-pin" style="background:${leg.route!.color}">${n}</span>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            })}
          >
            <Tooltip direction="top" offset={[0, -14]} className="station-tip">
              <span className="station-tip__role">{n}. biniş</span>
              <span>{leg.from!.name}</span>
              <span className="station-tip__meta">{leg.route!.ref || leg.route!.name}</span>
            </Tooltip>
          </Marker>
        ))}
      </Pane>
    </MapContainer>
  )
}

function FitTo({ paths, padding }: { paths: [number, number][][]; padding: FitPadding }) {
  const map = useMap()
  // Harita boyutu değişince (pencere, panel ya da başlangıçta sıfır boyutlu kapsayıcı) yeniden sığdır.
  const [resizeTick, setResizeTick] = useState(0)
  useEffect(() => {
    const onResize = () => setResizeTick((t) => t + 1)
    map.on('resize', onResize)
    return () => {
      map.off('resize', onResize)
    }
  }, [map])
  const key = JSON.stringify([paths.map((p) => [p[0], p[p.length - 1], p.length]), padding, resizeTick])
  useEffect(() => {
    const pts = paths.flat()
    // Biniş yoksa tüm raylı ağı göster (senaryo boşken ya da binişler temizlenince).
    const target = pts.length > 1 ? latLngBounds(pts) : IZMIR_BOUNDS
    const size = map.getSize()
    if (size.x === 0 || size.y === 0) return
    // Harita, kartların kapladığı kenardan küçükse (dar pencere) boşluğu orantılı küçült; aksi hâlde Leaflet NaN üretir.
    const [tl, br] = [point(padding.topLeft), point(padding.bottomRight)]
    const sx = Math.min(1, (size.x * 0.7) / (tl.x + br.x))
    const sy = Math.min(1, (size.y * 0.7) / (tl.y + br.y))
    // flyToBounds, önceki uçuş bitmeden yenisi gelirse (hızlı düzenleme, StrictMode) ara durumda takılabiliyor;
    // süren animasyonu durdurup fitBounds ile yakınlaştırmak her durumda tutarlı.
    map.stop()
    map.fitBounds(target, {
      paddingTopLeft: [tl.x * sx, tl.y * sy],
      paddingBottomRight: [br.x * sx, br.y * sy],
      maxZoom: 15,
      animate: true,
    })
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps -- yalnızca güzergah/yerleşim değişince
  return null
}
