// tarife.izmirimkart.com.tr İZBAN ücret servisinin istemcisi.
// Uç nokta CORS başlığı döndürmediği için tarayıcı yerine bu sunucu üzerinden çağrılır.
import { readFileSync } from 'node:fs'
import { Agent, get } from 'node:https'
import { rootCertificates } from 'node:tls'
import type { FareResult } from './fare-types.ts'

const UPSTREAM = 'https://tarife.izmirimkart.com.tr/IzbanTutarHesapla'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const UPSTREAM_TIMEOUT_MS = 10_000

// Sunucu TLS zincirindeki ara sertifikayı (RapidSSL TLS RSA CA G1) göndermiyor.
// Doğrulamayı kapatmak yerine eksik ara sertifikayı güven listesine ekliyoruz.
// Kaynak: http://cacerts.rapidssl.com/RapidSSLTLSRSACAG1.crt (geçerlilik: 2027-11-02)
const agent = new Agent({
  keepAlive: true,
  ca: [...rootCertificates, readFileSync(new URL('./certs/rapidssl-tls-rsa-ca-g1.pem', import.meta.url), 'utf8')],
})

function getJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = get(url, { agent, timeout: UPSTREAM_TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new FareError(502, `Tarife servisi hata döndürdü (${res.statusCode})`))
        return
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          reject(new FareError(502, 'Tarife servisinden beklenmeyen yanıt'))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('Zaman aşımı')))
    req.on('error', reject)
  })
}

type UpstreamFare = {
  BinisIstasyonu: string
  InisIstasyonu: string
  ToplamKm: number
  TamUcret: number
  OgrenciUcret: number
  OgretmenUcret: number
  Yas60Ucret: number
  SerbestUcret: number
  MinBakiyeTam: number
  MinBakiyeOgrenci: number
  MinBakiyeOgretmen: number
  MinBakiye60Yas: number
  MinBakiyeSerbest: number
  IadeTam: number
  IadeOgrenci: number
  IadeOgretmen: number
  Iade60Yas: number
  IadeSerbest: number
}

export class FareError extends Error {
  readonly status: 400 | 502
  constructor(status: 400 | 502, message: string) {
    super(message)
    this.status = status
  }
}

const cache = new Map<string, { at: number; value: FareResult }>()

function normalize(raw: UpstreamFare, date: string): FareResult {
  return {
    from: raw.BinisIstasyonu,
    to: raw.InisIstasyonu,
    km: raw.ToplamKm,
    date,
    fares: [
      { type: 'tam', label: 'Tam', unit: 'TL', price: raw.TamUcret, minBalance: raw.MinBakiyeTam, refund: raw.IadeTam },
      { type: 'ogrenci', label: 'Öğrenci', unit: 'TL', price: raw.OgrenciUcret, minBalance: raw.MinBakiyeOgrenci, refund: raw.IadeOgrenci },
      { type: 'ogretmen', label: 'Öğretmen', unit: 'TL', price: raw.OgretmenUcret, minBalance: raw.MinBakiyeOgretmen, refund: raw.IadeOgretmen },
      { type: 'yas60', label: '60 Yaş', unit: 'TL', price: raw.Yas60Ucret, minBalance: raw.MinBakiye60Yas, refund: raw.Iade60Yas },
      { type: 'serbest', label: 'Serbest', unit: 'kontör', price: raw.SerbestUcret, minBalance: raw.MinBakiyeSerbest, refund: raw.IadeSerbest },
    ],
  }
}

export async function getFare(fromId: number, toId: number, date: string): Promise<FareResult> {
  if (!Number.isInteger(fromId) || !Number.isInteger(toId) || fromId <= 0 || toId <= 0) {
    throw new FareError(400, 'Geçersiz istasyon')
  }
  if (fromId === toId) throw new FareError(400, 'Biniş ve iniş istasyonu aynı olamaz')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new FareError(400, 'Geçersiz tarih (YYYY-AA-GG bekleniyor)')
  }

  const key = `${fromId}/${toId}/${date}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  // aktarma=0, htt=0: 2025-09-01 sonrası tarifede bu parametreler kullanılmıyor.
  const url = `${UPSTREAM}/${fromId}/${toId}/0/0/${date}`
  let raw: UpstreamFare | null
  try {
    raw = (await getJson(url)) as UpstreamFare | null
  } catch (err) {
    if (err instanceof FareError) throw err
    console.error('Tarife servisi isteği başarısız:', url, err instanceof Error ? err.message : err)
    throw new FareError(502, 'Tarife servisine ulaşılamadı')
  }
  if (!raw || typeof raw.TamUcret !== 'number') throw new FareError(502, 'Tarife servisinden beklenmeyen yanıt')

  const value = normalize(raw, date)
  cache.set(key, { at: Date.now(), value })
  return value
}
