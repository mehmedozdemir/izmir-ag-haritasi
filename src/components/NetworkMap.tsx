import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Pane, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import { izbanSegment, lines, stationByTarifeId, stations, transferStations, type Station } from '../network'

type Props = {
  fromId: number | null
  toId: number | null
  onStationClick: (tarifeId: number) => void
}

// Kişisel kullanımda OSM'nin kendi tile sunucusu yeterli. Şirket içi/yoğun kullanımda
// OSM tile politikası gereği VITE_TILE_URL ile ticari bir sağlayıcıya ya da kendi sunucunuza geçin.
const TILE_URL = import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  import.meta.env.VITE_TILE_ATTRIBUTION ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'

const IZMIR_BOUNDS =latLngBounds(stations.map((s) => [s.lat, s.lng]))

export function NetworkMap({ fromId, toId, onStationClick }: Props) {
  const segment = useMemo(
    () => (fromId !== null && toId !== null ? izbanSegment(fromId, toId) : []),
    [fromId, toId],
  )
  const hasRoute = segment.length > 1

  return (
    <MapContainer bounds={IZMIR_BOUNDS} boundsOptions={{ padding: [24, 24] }} zoomControl={false} className="h-full w-full">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} className="basemap" />
      <FitToRoute segment={segment} />

      <Pane name="lines" style={{ zIndex: 410 }}>
        {lines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.coords}
            pathOptions={{
              color: line.color,
              weight: 5,
              opacity: hasRoute ? (line.kind === 'izban' ? 0.25 : 0.35) : 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}
        {hasRoute && (
          <>
            <Polyline positions={segment} pathOptions={{ color: '#ffffff', weight: 11, opacity: 1 }} />
            <Polyline positions={segment} pathOptions={{ color: '#d7262e', weight: 7, opacity: 1 }} />
          </>
        )}
      </Pane>

      <Pane name="stations" style={{ zIndex: 420 }}>
        {stations.map((s) => (
          <StationMarker
            key={s.id}
            station={s}
            role={s.tarifeId === undefined ? null : s.tarifeId === fromId ? 'from' : s.tarifeId === toId ? 'to' : null}
            dimmed={hasRoute && !isOnRoute(s, fromId, toId)}
            onClick={onStationClick}
          />
        ))}
      </Pane>
    </MapContainer>
  )
}

function isOnRoute(s: Station, fromId: number | null, toId: number | null) {
  if (s.tarifeId === undefined || fromId === null || toId === null) return false
  const a = stationByTarifeId.get(fromId)!.order
  const b = stationByTarifeId.get(toId)!.order
  return s.order >= Math.min(a, b) && s.order <= Math.max(a, b)
}

function StationMarker({
  station,
  role,
  dimmed,
  onClick,
}: {
  station: Station
  role: 'from' | 'to' | null
  dimmed: boolean
  onClick: (tarifeId: number) => void
}) {
  const isIzban = station.tarifeId !== undefined
  const lineColor = isIzban ? '#d7262e' : '#1e5aa8'
  const selected = role !== null
  const transfer = isIzban && transferStations.has(station.name)

  return (
    <>
      {isIzban && (
        // Küçük durak noktalarına dokunmatik ekranda da kolay tıklanabilmesi için görünmez geniş alan.
        <CircleMarker
          center={[station.lat, station.lng]}
          radius={14}
          pathOptions={{ stroke: false, fillOpacity: 0 }}
          bubblingMouseEvents={false}
          eventHandlers={{ click: () => onClick(station.tarifeId!) }}
          className="cursor-pointer"
        />
      )}
      <CircleMarker
        center={[station.lat, station.lng]}
        radius={selected ? 9 : transfer ? 6.5 : isIzban ? 5 : 4.5}
        pathOptions={{
          color: selected ? (role === 'from' ? '#0f766e' : '#111827') : lineColor,
          weight: selected ? 4 : 2.5,
          fillColor: '#ffffff',
          fillOpacity: 1,
          opacity: dimmed ? 0.35 : 1,
        }}
        bubblingMouseEvents={false}
        eventHandlers={isIzban ? { click: () => onClick(station.tarifeId!) } : undefined}
        className={isIzban ? 'station station--izban cursor-pointer' : 'station station--metro cursor-default'}
      >
        <Tooltip
          key={selected ? 'sel' : 'hover'}
          permanent={selected}
          direction="top"
          offset={[0, -8]}
          className={selected ? `station-tip station-tip--${role}` : 'station-tip'}
        >
          {selected && <span className="station-tip__role">{role === 'from' ? 'Biniş' : 'İniş'}</span>}
          <span>{station.name}</span>
          {!selected && !isIzban && <span className="station-tip__meta">Metro M1</span>}
          {!selected && transfer && <span className="station-tip__meta">Metro aktarma</span>}
        </Tooltip>
      </CircleMarker>
    </>
  )
}

function FitToRoute({ segment }: { segment: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (segment.length > 1) {
      map.flyToBounds(latLngBounds(segment), { padding: [60, 60], maxZoom: 14, duration: 0.8 })
    }
  }, [map, segment])
  return null
}
