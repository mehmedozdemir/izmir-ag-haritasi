# İZBAN Ücret Haritası

İzmir'in İZBAN ve Metro M1 hatlarını harita üzerinde gösterir. Biniş ve iniş istasyonu seçildiğinde (haritadan
veya listeden) iki durak arasındaki İZBAN ücretini kart tiplerine göre (Tam, Öğrenci, Öğretmen, 60 Yaş, Serbest)
ve binişte kartta bulunması gereken bakiye / inişte iade edilen tutar ile birlikte görselleştirir.

## Çalıştırma

```bash
npm install
npm run dev          # API :8787 + Vite :5173
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
| Harita | Leaflet / react-leaflet, OSM tile | `src/components/NetworkMap.tsx` |
| Veri çekme | TanStack Query | `src/api.ts` |
| Backend | Hono (Node) | `server/` — `/api/fare` proxy + 12 saatlik bellek önbelleği |
| Hat/durak verisi | OpenStreetMap (Overpass), statik JSON | `src/data/network.json` |

### Ücret servisi

`GET /api/fare?from={tarifeId}&to={tarifeId}&date=YYYY-MM-DD`

Arka planda `https://tarife.izmirimkart.com.tr/IzbanTutarHesapla/{binis}/{inis}/0/0/{tarih}` çağrılır. Bu uç nokta
CORS başlığı döndürmediği için tarayıcıdan doğrudan çağrılamaz, bu yüzden backend proxy olarak çalışır.
Resmi/dokümante bir API değildir; haber verilmeden değişebilir.

Tarife sunucusu TLS zincirindeki ara sertifikayı göndermediğinden, eksik `RapidSSL TLS RSA CA G1` ara sertifikası
`server/certs/` altında tutulur ve yalnızca bu istekler için güven listesine eklenir (doğrulama kapatılmaz).
Sertifika 2027-11-02'de sona erer; sunucu sertifikası yenilendiğinde bu dosyanın da güncellenmesi gerekebilir.

### Hat ve durak verisinin güncellenmesi

```bash
npm run data:network
```

OSM route ilişkileri (İZBAN 15423228 + 16191186, Metro M1 2707717) çekilir ve `src/data/network.json` yeniden üretilir.
OSM durak adı → tarife ID eşlemesi `scripts/build-network.mjs` içindedir. Overpass sunucuları meşgulse ham yanıt
indirilip `node scripts/build-network.mjs --raw osm.json` ile de üretilebilir.

## Harita altlığı ve lisanslar

- Hat/durak verisi ve harita: © OpenStreetMap katkıcıları, ODbL.
- Varsayılan altlık `tile.openstreetmap.org` — yalnızca düşük trafikli kişisel kullanım için uygundur
  ([OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)). Şirket içi kullanımda
  `VITE_TILE_URL` ve `VITE_TILE_ATTRIBUTION` ile ticari bir sağlayıcıya ya da kendi tile sunucunuza geçin.
- Ücret bilgileri İzmirim Kart tarife sayfasından alınır ve bilgilendirme amaçlıdır.
