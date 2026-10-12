// Yolculuk simülasyonu için hat/durak verisini üretir:
//   public/data/transit/index.json        → tüm hatların listesi (mod, numara, ad, renk, yönler)
//   public/data/transit/routes/{id}.json  → yön başına sıralı duraklar, tipik seyahat süresi, güzergah çizgisi
//
// Kaynaklar:
//   - Otobüs (ESHOT), Metro, Tramvay: İzmir BB Açık Veri GTFS (İzmir Büyükşehir Belediyesi Açık Veri Lisansı)
//   - İZBAN: src/data/network.json (OSM, ODbL; npm run data:network ile üretilir)
//   - İzdeniz: GTFS bağlantısı çalışmadığı için iskeleler aşağıda sabit tanımlıdır (konumlar OSM vapur hatlarından)
//
// Kullanım: npm run data:transit   (veya: node scripts/build-transit.mjs --gtfs-dir <indirilmiş zip klasörü>)
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { unzipSync } from 'fflate'

const FEEDS = [
  { key: 'bus', file: 'bus-eshot-gtfs.zip', url: 'https://www.eshot.gov.tr/gtfs/bus-eshot-gtfs.zip' },
  { key: 'metro', file: 'rail-metro-gtfs.zip', url: 'https://www.izmirmetro.com.tr/gtfs/rail-metro-gtfs.zip' },
  { key: 'tram', file: 'rail-tramizmir-gtfs.zip', url: 'https://www.tramizmir.com/gtfs/rail-tramizmir-gtfs.zip' },
]

const DEFAULT_COLORS = { bus: '#0f766e', metro: '#1e5aa8', tram: '#ad1457', izban: '#d7262e', ferry: '#0369a1' }

// Seyahat süresi tahmini için ortalama hızlar (km/s) — GTFS saati olmayan modlar için.
const IZBAN_KMH = 45
const FERRY_KMH = 22

// İzdeniz yolcu iskeleleri (merkez körfez). Koordinatlar OSM vapur hattı geometrilerinin uç noktalarından alınmıştır.
const PIERS = [
  { id: 'bostanli', name: 'Bostanlı', lat: 38.45178, lng: 27.0979 },
  { id: 'karsiyaka', name: 'Karşıyaka', lat: 38.45524, lng: 27.12016 },
  { id: 'alsancak', name: 'Alsancak', lat: 38.43898, lng: 27.14071 },
  { id: 'pasaport', name: 'Pasaport', lat: 38.42876, lng: 27.13234 },
  { id: 'konak', name: 'Konak', lat: 38.41878, lng: 27.12513 },
  { id: 'goztepe', name: 'Göztepe', lat: 38.40859, lng: 27.10632 },
  { id: 'uckuyular', name: 'Üçkuyular', lat: 38.40579, lng: 27.07019 },
]

const OUT_DIR = new URL('../public/data/transit/', import.meta.url)

// ---------------------------------------------------------------- yardımcılar

const round5 = (n) => Math.round(n * 1e5) / 1e5

function haversineKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Birbirine ~15 m'den yakın ardışık noktaları atarak çizgiyi hafifletir. */
function thin(coords, minKm = 0.015) {
  const out = []
  for (const p of coords) {
    if (out.length === 0 || haversineKm(out[out.length - 1], p) >= minKm) out.push(p)
  }
  const last = coords[coords.length - 1]
  if (last && out[out.length - 1] !== last) out.push(last)
  return out.map(([y, x]) => [round5(y), round5(x)])
}

const toSecs = (hms) => {
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600 + m * 60 + (s || 0)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** GTFS CSV (bu akışlarda tırnak kullanılmıyor) → satır nesneleri üzerinde gezinme. */
function* csvRows(bytes) {
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '')
  let start = 0
  let header = null
  while (start < text.length) {
    let end = text.indexOf('\n', start)
    if (end === -1) end = text.length
    const line = text.slice(start, end).replace(/\r$/, '')
    start = end + 1
    if (!line) continue
    const cols = line.split(',')
    if (!header) {
      header = cols
      continue
    }
    const row = {}
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] ?? ''
    yield row
  }
}

/** "LAKA MAHALLESİ - BORNOVA METRO" → "Laka Mahallesi - Bornova Metro" */
function titleCaseTr(s) {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s\-(/.])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('tr-TR'))
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadFeed(feed, gtfsDir) {
  let buf
  if (gtfsDir) {
    buf = await readFile(join(gtfsDir, feed.file))
  } else {
    console.log(`İndiriliyor: ${feed.url}`)
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(180_000) })
    if (!res.ok) throw new Error(`${feed.url} → ${res.status}`)
    buf = Buffer.from(await res.arrayBuffer())
  }
  const files = unzipSync(new Uint8Array(buf))
  const get = (name) => {
    const key = Object.keys(files).find((k) => k.endsWith(name))
    return key ? files[key] : null
  }
  return { get }
}

// ---------------------------------------------------------------- GTFS → hatlar

function buildFromGtfs(feed, gtfs) {
  const stops = new Map()
  for (const s of csvRows(gtfs.get('stops.txt'))) {
    stops.set(s.stop_id, { name: s.stop_name.trim(), lat: Number(s.stop_lat), lng: Number(s.stop_lon) })
  }

  const routes = new Map()
  for (const r of csvRows(gtfs.get('routes.txt'))) routes.set(r.route_id, r)

  const trips = new Map()
  for (const t of csvRows(gtfs.get('trips.txt'))) trips.set(t.trip_id, t)

  // trip_id → [[sıra, stop_id, saniye]]
  const tripStops = new Map()
  for (const st of csvRows(gtfs.get('stop_times.txt'))) {
    let list = tripStops.get(st.trip_id)
    if (!list) tripStops.set(st.trip_id, (list = []))
    list.push([Number(st.stop_sequence), st.stop_id, toSecs(st.departure_time || st.arrival_time)])
  }

  const shapes = new Map()
  const shapesFile = gtfs.get('shapes.txt')
  if (shapesFile) {
    for (const p of csvRows(shapesFile)) {
      let list = shapes.get(p.shape_id)
      if (!list) shapes.set(p.shape_id, (list = []))
      list.push([Number(p.shape_pt_sequence), Number(p.shape_pt_lat), Number(p.shape_pt_lon)])
    }
    for (const list of shapes.values()) list.sort((a, b) => a[0] - b[0])
  }

  // Hat + yön başına en sık görülen durak dizisini (desen) seç; süreleri o desendeki seferlerin medyanı yap.
  // Metro/tramvayda aynı fiziksel hat birden çok route_id olarak gelebildiği için anahtar route_id'dir.
  const groups = new Map() // `${route_id}|${dir}` → Map(signature → { stops, times: number[][], shapeId })
  for (const [tripId, list] of tripStops) {
    const trip = trips.get(tripId)
    if (!trip) continue
    list.sort((a, b) => a[0] - b[0])
    const ids = list.map((x) => x[1])
    const sig = ids.join('>')
    const key = `${trip.route_id}|${trip.direction_id || '0'}`
    let byPattern = groups.get(key)
    if (!byPattern) groups.set(key, (byPattern = new Map()))
    let pat = byPattern.get(sig)
    if (!pat) byPattern.set(sig, (pat = { ids, times: [], shapeId: trip.shape_id, headsign: trip.trip_headsign }))
    const t0 = list[0][2]
    pat.times.push(list.map((x) => x[2] - t0))
  }

  const out = []
  const byRoute = new Map()
  for (const [key, byPattern] of groups) {
    const [routeId, dir] = key.split('|')
    const best = [...byPattern.values()].sort((a, b) => b.times.length - a.times.length)[0]
    const tMedian = best.ids.map((_, i) => Math.round(median(best.times.map((ts) => ts[i]))))
    const stopList = best.ids
      .map((id, i) => {
        const s = stops.get(id)
        return s && { id: `${feed.key}:${id}`, code: id, name: s.name, lat: round5(s.lat), lng: round5(s.lng), t: tMedian[i] }
      })
      .filter(Boolean)
    if (stopList.length < 2) continue

    const shapeRaw = best.shapeId && shapes.get(best.shapeId)
    const shape = thin(shapeRaw ? shapeRaw.map((p) => [p[1], p[2]]) : stopList.map((s) => [s.lat, s.lng]))

    let entry = byRoute.get(routeId)
    if (!entry) byRoute.set(routeId, (entry = []))
    entry.push({ id: dir, name: best.headsign || `${stopList[stopList.length - 1].name} yönü`, stops: stopList, shape })
  }

  for (const [routeId, dirs] of byRoute) {
    const r = routes.get(routeId)
    if (!r) continue
    dirs.sort((a, b) => a.id.localeCompare(b.id))
    for (const d of dirs) d.name = `${d.stops[0].name} → ${d.stops[d.stops.length - 1].name}`
    const mode = r.route_type === '0' ? 'tram' : r.route_type === '1' ? 'metro' : 'bus'
    const ref = r.route_short_name || ''
    out.push({
      id: `${feed.key}-${routeId}`.toLowerCase(),
      mode,
      ref,
      name: titleCaseTr(r.route_long_name || ref),
      color: r.route_color ? `#${r.route_color}` : DEFAULT_COLORS[mode],
      dirs,
    })
  }
  return out
}

/** Metro akışında her yön ayrı route_id olarak gelir (1: Evka 3 → Kaymakamlık, 2: tersi); tek hatta birleştir. */
function mergeSameRef(routes) {
  const merged = new Map()
  for (const r of routes) {
    const key = `${r.mode}|${r.ref || r.id}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...r, id: r.ref ? `${r.mode}-${r.ref}`.toLowerCase() : r.id })
      continue
    }
    existing.dirs.push(...r.dirs)
  }
  for (const r of merged.values()) r.dirs.forEach((d, i) => (d.id = String(i)))
  return [...merged.values()]
}

// ---------------------------------------------------------------- İZBAN ve İzdeniz

async function buildIzban() {
  const net = JSON.parse(await readFile(new URL('../src/data/network.json', import.meta.url), 'utf8'))
  const line = net.lines.find((l) => l.id === 'izban')
  const stations = net.stations.filter((s) => s.line === 'izban').sort((a, b) => a.order - b.order)

  // Hat boyunca kümülatif km → tahmini süre (sn).
  const cum = [0]
  for (let i = 1; i < line.coords.length; i++) cum.push(cum[i - 1] + haversineKm(line.coords[i - 1], line.coords[i]))
  const forward = stations.map((s) => ({
    id: `izban:${s.tarifeId}`,
    code: String(s.tarifeId),
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    km: cum[s.shapeIndex],
  }))
  const withTimes = (list) => {
    const base = list[0].km
    return list.map(({ km, ...s }) => ({ ...s, t: Math.round((Math.abs(km - base) / IZBAN_KMH) * 3600) }))
  }
  const shape = thin(line.coords)
  return {
    id: 'izban',
    mode: 'izban',
    ref: 'İZBAN',
    name: 'İZBAN Aliağa - Selçuk',
    color: DEFAULT_COLORS.izban,
    dirs: [
      { id: '0', name: 'Aliağa → Selçuk', stops: withTimes(forward), shape },
      { id: '1', name: 'Selçuk → Aliağa', stops: withTimes([...forward].reverse()), shape: [...shape].reverse() },
    ],
  }
}

function buildFerry() {
  return {
    id: 'izdeniz',
    mode: 'ferry',
    ref: 'İzdeniz',
    name: 'İzdeniz Vapurları',
    color: DEFAULT_COLORS.ferry,
    // Vapurda herhangi iki iskele arasında yolculuk seçilebilir; süre mesafe/ortalama hızdan hesaplanır.
    anyOrder: true,
    speedKmh: FERRY_KMH,
    dirs: [
      {
        id: '0',
        name: 'İskeleler',
        stops: PIERS.map((p) => ({ id: `ferry:${p.id}`, code: p.id, name: p.name, lat: p.lat, lng: p.lng, t: 0 })),
        shape: [],
      },
    ],
  }
}

// ---------------------------------------------------------------- ana akış

const gtfsDirIdx = process.argv.indexOf('--gtfs-dir')
const gtfsDir = gtfsDirIdx > 0 ? process.argv[gtfsDirIdx + 1] : null

const all = []
for (const feed of FEEDS) {
  const gtfs = await loadFeed(feed, gtfsDir)
  const routes = buildFromGtfs(feed, gtfs)
  const merged = feed.key === 'bus' ? routes : mergeSameRef(routes)
  console.log(`${feed.key}: ${merged.length} hat`)
  all.push(...merged)
}
all.push(await buildIzban(), buildFerry())

const modeOrder = { metro: 0, izban: 1, tram: 2, ferry: 3, bus: 4 }
const refNum = (r) => Number.parseInt(r.ref, 10)
all.sort((a, b) => modeOrder[a.mode] - modeOrder[b.mode] || (refNum(a) || 0) - (refNum(b) || 0) || a.name.localeCompare(b.name, 'tr'))

await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(new URL('routes/', OUT_DIR), { recursive: true })

const index = {
  generatedAt: new Date().toISOString(),
  sources: [
    'Otobüs, Metro, Tramvay: İzmir Büyükşehir Belediyesi Açık Veri (GTFS)',
    'İZBAN hat geometrisi, İzdeniz iskeleleri: © OpenStreetMap katkıcıları (ODbL)',
  ],
  routes: all.map(({ dirs, ...r }) => ({ ...r, dirs: dirs.map((d) => ({ id: d.id, name: d.name })) })),
}
await writeFile(new URL('index.json', OUT_DIR), JSON.stringify(index))
let bytes = 0
for (const r of all) {
  const body = JSON.stringify({ id: r.id, dirs: r.dirs })
  bytes += body.length
  await writeFile(new URL(`routes/${r.id}.json`, OUT_DIR), body)
}
console.log(`Toplam ${all.length} hat yazıldı (${(bytes / 1024 / 1024).toFixed(1)} MB) → public/data/transit/`)
