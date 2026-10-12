# İzmir Ücret Haritası

İzmir toplu ulaşımı için iki araç:

- **Yolculuk Simülasyonu** — ESHOT otobüsleri, Metro, Tramvay, İZBAN ve İzdeniz vapurlarıyla istediğiniz sırada
  binişler ekleyin. Her binişte karttan ne kadar kesildiği, blokaj ve iade, 90 dakika aktarma hakkı ve Halk Taşıt
  indirimi kart tiplerine göre (Tam, Genç, Öğretmen, 60 Yaş) hesaplanır; isteğe bağlı olarak kart bakiyesi takip edilir.
- **İZBAN Ücreti** — haritada iki İZBAN istasyonu seçerek mesafe bazlı ücreti, binişte gereken bakiyeyi ve inişte
  iade edilen tutarı görün.

## Çalıştırma

```bash
npm install
npm run dev          # API :8787 + Vite :5173
npm test             # ücret motoru senaryo testleri
```

Üretim (tek süreç; API + derlenmiş frontend):

```bash
npm run build
npm start            # PORT ortam değişkeni, varsayılan 8787
```

Docker (Compose):

```bash
docker compose up -d --build     # http://localhost:8090
docker compose logs -f           # loglar
docker compose down              # durdur
```

Host portu `HOST_PORT` ile değiştirilebilir (ör. `HOST_PORT=9000 docker compose up -d`). Container `restart: unless-stopped`
ile Docker açıldığında otomatik başlar ve `/api/health` üzerinden sağlık kontrolü yapılır.

Node.js ≥ 22.18 gerekir (sunucu TypeScript dosyaları Node'un yerleşik tip ayıklamasıyla çalışır).

## Mimari

| Katman | Teknoloji | Not |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite, Tailwind CSS 4 | `src/` |
| Harita | Leaflet / react-leaflet, OSM tile | `src/components/NetworkMap.tsx`, `src/components/sim/SimMap.tsx` |
| Ücret motoru | Saf TypeScript + Vitest | `src/fare/engine.ts`, `src/fare/tariffs.ts` |
| Veri çekme | TanStack Query | `src/api.ts`, `src/transit/data.ts` |
| Backend | Hono (Node) | `server/` — ücret servisleri için proxy + 12 saatlik bellek önbelleği |
| Hat/durak verisi | İzmir BB GTFS + OSM, statik JSON | `public/data/transit/`, `src/data/network.json` |

## Ücret kuralları

Tarife tabloları ve otobüs hattı → tarife (A…K) eşlemesi `src/fare/tariffs.ts` içindedir
(kaynak: [izmirimkart.com.tr/tarife-ve-ucretlendirme](https://izmirimkart.com.tr/tarife-ve-ucretlendirme), 01.04.2026 tarifesi).
**Tarife değiştiğinde güncellenmesi gereken tek dosya budur.**

`src/fare/engine.ts` şu kuralları uygular:

- Aktarma hakkı olan tarifelerde (A, E, K ve aşağıdaki parametreyle İZBAN) ilk ücretli binişle 90 dk başlar; bu sürede sonraki binişler ücretsizdir.
- 5 dk koruma süresi dolmadan yapılan binişte ve 30 dk içinde aynı hat / istasyona tekrar binişte aktarma verilmez.
- Halk Taşıt (05–07, 19–20) saatlerinde ilgili tarifelerde ücret yarıdır (İZBAN, Havalimanı ve Baykuş hariç).
- Genç kartla Yerleşke (E) tarifesinden 90 dk içinde A/K tarifesine geçişte aradaki fark tahsil edilir.
- İZBAN ve "Gittiğin Kadar Öde" hatlarında binişte blokaj, inişte iade uygulanır (tutarlar resmi servislerden).

**İZBAN aktarması** (15.10.2026 itibarıyla; arayüzde "İZBAN aktarmaya dahil" ile açılıp kapatılır, varsayılan açık):
açık bir 90 dk süresi içinde İZBAN'a binildiğinde blokaj alınır, inişte İZBAN'ın ilk 20 km ücreti ödenmiş sayılarak
yalnızca aşan mesafe tahsil edilir ve blokajın kalanı iade edilir. İlk biniş İZBAN ise tam ücret ödenir ve 90 dk başlar.
Kesin uygulama kuralları yayımlandığında `simulate()` içindeki İZBAN dalı güncellenmelidir.

**Varsayım:** aktarma hakkı olmayan tarifeler (B, C, D, F, G, J) 90 dk süresini ne başlatır ne bozar.

## Ücret servisleri

| Uç nokta | Arka plandaki servis |
|---|---|
| `GET /api/fare?from={tarifeId}&to={tarifeId}&date=YYYY-MM-DD` | `tarife.izmirimkart.com.tr/IzbanTutarHesapla/...` (İZBAN) |
| `GET /api/fare/eshot?line=602&dir=1&from=23802&to=24192&htt=0` | `eshot.gov.tr/tr/MesafeTutarHesapla/...` (Gittiğin Kadar Öde; `dir` 1 = gidiş, 2 = dönüş) |

Bu uç noktalar CORS başlığı döndürmediği için backend proxy olarak çalışır. Resmi/dokümante API değildir; haber verilmeden değişebilir.

Tarife sunucusu TLS zincirindeki ara sertifikayı göndermediğinden, eksik `RapidSSL TLS RSA CA G1` ara sertifikası
`server/certs/` altında tutulur ve yalnızca bu istekler için güven listesine eklenir (doğrulama kapatılmaz).
Sertifika 2027-11-02'de sona erer; sunucu sertifikası yenilendiğinde bu dosyanın da güncellenmesi gerekebilir.

## Hat ve durak verisinin güncellenmesi

```bash
npm run data:network   # İZBAN + Metro hat geometrisi (OSM) → src/data/network.json
npm run data:transit   # tüm hatlar (GTFS + OSM) → public/data/transit/
```

`data:transit`, İzmir BB Açık Veri portalındaki ESHOT, Metro ve Tramvay GTFS dosyalarını indirir; her hat/yön için en sık
sefer desenini ve duraklar arası medyan seyahat süresini çıkarır. İZBAN `src/data/network.json`'dan (önce `data:network`),
İzdeniz iskeleleri script içindeki sabit listeden gelir (İzdeniz GTFS bağlantısı çalışmıyor). GTFS dosyaları önceden
indirildiyse `node scripts/build-transit.mjs --gtfs-dir <klasör>` ile de üretilebilir.

ESHOT GTFS'teki durak numaraları ESHOT ücret servisindekilerle aynıdır; GTFS `direction_id` 0 → ESHOT gidiş (1).

## Harita altlığı ve lisanslar

- Otobüs, Metro, Tramvay verisi: İzmir Büyükşehir Belediyesi Açık Veri Lisansı.
- İZBAN hat geometrisi, İzdeniz iskeleleri ve harita: © OpenStreetMap katkıcıları, ODbL.
- Varsayılan altlık `tile.openstreetmap.org` — yalnızca düşük trafikli kişisel kullanım için uygundur
  ([OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)). Şirket içi kullanımda
  `VITE_TILE_URL` ve `VITE_TILE_ATTRIBUTION` ile ticari bir sağlayıcıya ya da kendi tile sunucunuza geçin.
- Ücret bilgileri bilgilendirme amaçlıdır.
