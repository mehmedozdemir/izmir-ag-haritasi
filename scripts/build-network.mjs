// OSM (Overpass) üzerinden İZBAN ve Metro hat geometrisi + duraklarını çekip
// src/data/network.json olarak kaydeder. Veri © OpenStreetMap katkıcıları, ODbL.
// Kullanım: npm run data:network   (veya: node scripts/build-network.mjs --raw osm.json)
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

// Her hat, sırayla birleştirilecek OSM route ilişkilerinden oluşur.
const LINES = [
  {
    id: 'izban',
    name: 'İZBAN',
    kind: 'izban',
    color: '#d7262e',
    relations: [15423228, 16191186], // Aliağa → Tepeköy, Tepeköy → Selçuk
  },
  {
    id: 'm1',
    name: 'Metro M1',
    kind: 'metro',
    color: '#1e5aa8',
    relations: [2707717], // Kaymakamlık → Evka 3
  },
]

// OSM adı → tarife.izmirimkart.com.tr istasyon ID'si (yalnızca İZBAN).
const IZBAN_TARIFE_IDS = {
  'Aliağa': 1, 'Biçerova': 2, 'Hatundere': 3, 'Menemen': 4, 'Egekent 2': 5,
  'Ulukent': 6, 'Egekent': 7, 'Atasanayi': 8, 'Çiğli': 9, 'Mavişehir': 10,
  'Şemikler': 11, 'Demirköprü': 13, 'Nergiz': 14, 'Karşıyaka': 15, 'Alaybey': 16,
  'Naldöken': 17, 'Turan': 18, 'Bayraklı': 19, 'Salhane': 20, 'Halkapınar': 21,
  'Alsancak Gar': 34, 'Hilal': 35, 'Kemer': 23, 'Şirinyer': 24, 'Koşu': 25,
  'İnkılap': 26, 'Semt Garajı': 27, 'ESBAŞ': 28, 'Gaziemir': 29, 'Sarnıç': 30,
  'Havalimanı': 31, 'Cumaovası': 32, 'Develi': 38, 'Tekeli': 40, 'Pancar': 42,
  'Kuşçuburun': 43, 'Torbalı': 44, 'Tepeköy': 45, 'Sağlık': 47, 'Belevi': 50,
  'Selçuk': 48,
}

// Haritada gösterilecek ad (OSM adı tarife adından farklıysa).
const DISPLAY_NAMES = { 'Atasanayi': 'Ata Sanayi', 'Alsancak Gar': 'Alsancak', 'ESBAŞ': 'Esbaş' }

async function overpass(query) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await tryEndpoints(query)
    if (result) return result
    console.warn(`Deneme ${attempt} başarısız, bekleniyor...`)
    await new Promise((r) => setTimeout(r, attempt * 10_000))
  }
  throw new Error('Hiçbir Overpass sunucusundan veri alınamadı')
}

async function tryEndpoints(query) {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'IzmirAgHaritasi/0.1 (personal)', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(150_000),
      })
      const text = await res.text()
      if (res.ok && text.startsWith('{')) return JSON.parse(text)
      console.warn(`Overpass yanıtı geçersiz (${url}): ${res.status}`)
    } catch (err) {
      console.warn(`Overpass hatası (${url}): ${err.message}`)
    }
  }
  return null
}

const round = (n) => Math.round(n * 1e5) / 1e5
const sameNode = (a, b) => a.lat === b.lat && a.lon === b.lon

// Route ilişkisindeki way parçalarını yönlerini düzelterek tek bir çizgiye ekler.
function chainWays(ways) {
  const line = []
  for (const geom of ways) {
    if (line.length === 0) {
      line.push(...geom)
      continue
    }
    const tail = line[line.length - 1]
    if (sameNode(tail, geom[0])) line.push(...geom.slice(1))
    else if (sameNode(tail, geom[geom.length - 1])) line.push(...geom.slice(0, -1).reverse())
    else if (line.length === ways[0].length && sameNode(line[0], geom[0])) {
      // İlk parça ters yönlüymüş.
      line.reverse()
      line.push(...geom.slice(1))
    } else if (line.length === ways[0].length && sameNode(line[0], geom[geom.length - 1])) {
      line.reverse()
      line.push(...geom.slice(0, -1).reverse())
    } else {
      // Boşluk var: en yakın uca göre bağla.
      const d = (p, q) => (p.lat - q.lat) ** 2 + (p.lon - q.lon) ** 2
      line.push(...(d(tail, geom[0]) <= d(tail, geom[geom.length - 1]) ? geom : [...geom].reverse()))
    }
  }
  return line
}

function nearestIndex(coords, lat, lon) {
  let best = 0
  let bestD = Infinity
  coords.forEach(([y, x], i) => {
    const d = (y - lat) ** 2 + (x - lon) ** 2
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}

// --raw <dosya>: Overpass yerine daha önce indirilmiş ham yanıtı kullan.
const rawIdx = process.argv.indexOf('--raw')
const allIds = LINES.flatMap((l) => l.relations)
const data = rawIdx > 0
  ? JSON.parse(await readFile(process.argv[rawIdx + 1], 'utf8'))
  : await overpass(`[out:json][timeout:120];rel(id:${allIds.join(',')})->.r;.r out geom;node(r.r);out;`)
const nodes = new Map(data.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]))
const relations = new Map(data.elements.filter((e) => e.type === 'relation').map((e) => [e.id, e]))

const out = { source: '© OpenStreetMap contributors (ODbL)', generatedAt: new Date().toISOString(), lines: [], stations: [] }

for (const def of LINES) {
  const ways = []
  const stops = []
  for (const relId of def.relations) {
    const rel = relations.get(relId)
    if (!rel) throw new Error(`İlişki bulunamadı: ${relId}`)
    for (const m of rel.members) {
      if (m.type === 'way' && m.role === '' && m.geometry) ways.push(m.geometry)
      if (m.type === 'node' && m.role.startsWith('stop')) {
        const n = nodes.get(m.ref)
        const name = n?.tags?.name
        if (n && name && !stops.some((s) => s.osmName === name)) stops.push({ osmName: name, lat: n.lat, lon: n.lon })
      }
    }
  }

  const coords = chainWays(ways).map((p) => [round(p.lat), round(p.lon)])
  out.lines.push({ id: def.id, name: def.name, kind: def.kind, color: def.color, coords })

  stops.forEach((s, order) => {
    const tarifeId = def.kind === 'izban' ? IZBAN_TARIFE_IDS[s.osmName] : undefined
    if (def.kind === 'izban' && tarifeId === undefined) console.warn(`Tarife ID eşlemesi yok: ${s.osmName}`)
    out.stations.push({
      id: `${def.id}-${order}`,
      line: def.id,
      order,
      name: DISPLAY_NAMES[s.osmName] ?? s.osmName,
      lat: round(s.lat),
      lng: round(s.lon),
      shapeIndex: nearestIndex(coords, s.lat, s.lon),
      ...(tarifeId !== undefined && { tarifeId }),
    })
  })
  console.log(`${def.name}: ${stops.length} durak, ${coords.length} nokta`)
}

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
await writeFile(new URL('../src/data/network.json', import.meta.url), JSON.stringify(out))
console.log('src/data/network.json yazıldı')
