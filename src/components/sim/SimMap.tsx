import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Pane, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import { lines, stations } from '../../network'
import { shapeBetween } from '../../transit/data'
import type { ResolvedLeg } from '../../sim/useSimulation'
import { TILE_ATTRIBUTION, TILE_URL } from '../NetworkMap'

const IZMIR_BOUNDS = latLngBounds(stations.map((s) => [s.lat, s.lng]))

export function SimMap({ legs }: { legs: ResolvedLeg[] }) {
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

  return (
    <MapContainer bounds={IZMIR_BOUNDS} boundsOptions={{ padding: [24, 24] }} zoomControl={false} className="h-full w-full">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} className="basemap" />
      <FitTo paths={drawn.map((d) => d.path)} />

      {/* Bağlam için raylı ağ soluk olarak */}
      <Pane name="context" style={{ zIndex: 405 }}>
        {lines.map((l) => (
          <Polyline key={l.id} positions={l.coords} pathOptions={{ color: l.color, weight: 3, opacity: 0.18 }} interactive={false} />
        ))}
      </Pane>

      <Pane name="legs" style={{ zIndex: 410 }}>
        {drawn.map(({ leg, path }) => (
          <Polyline key={`${leg.draft.id}-casing`} positions={path} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9 }} interactive={false} />
        ))}
        {drawn.map(({ leg, path }) => (
          <Polyline
            key={leg.draft.id}
            positions={path}
            pathOptions={{
              color: leg.route!.color,
              weight: 6,
              opacity: 1,
              dashArray: leg.route!.mode === 'ferry' ? '2 10' : undefined,
              lineCap: 'round',
            }}
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
            pathOptions={{ color: leg.route!.color, weight: 3, fillColor: '#fff', fillOpacity: 1 }}
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

function FitTo({ paths }: { paths: [number, number][][] }) {
  const map = useMap()
  const key = JSON.stringify(paths.map((p) => [p[0], p[p.length - 1], p.length]))
  useEffect(() => {
    const pts = paths.flat()
    if (pts.length > 1) map.flyToBounds(latLngBounds(pts), { padding: [50, 50], maxZoom: 15, duration: 0.8 })
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps -- yalnızca güzergah değişince
  return null
}
