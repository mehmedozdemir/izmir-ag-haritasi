// Dış ücret servislerine (İzmirim Kart tarife, ESHOT) yapılan çağrılar için ortak yardımcılar.
import { get, type Agent } from 'node:https'

const UPSTREAM_TIMEOUT_MS = 10_000

export class FareError extends Error {
  readonly status: 400 | 502
  constructor(status: 400 | 502, message: string) {
    super(message)
    this.status = status
  }
}

export function getJson(url: string, agent?: Agent): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = get(url, { agent, timeout: UPSTREAM_TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new FareError(502, `Ücret servisi hata döndürdü (${res.statusCode})`))
        return
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          reject(new FareError(502, 'Ücret servisinden beklenmeyen yanıt'))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('Zaman aşımı')))
    req.on('error', reject)
  })
}

/** Ağ hatalarını kullanıcıya gösterilebilir FareError'a çevirir. */
export async function fetchUpstream(url: string, agent?: Agent): Promise<unknown> {
  try {
    return await getJson(url, agent)
  } catch (err) {
    if (err instanceof FareError) throw err
    console.error('Ücret servisi isteği başarısız:', url, err instanceof Error ? err.message : err)
    throw new FareError(502, 'Ücret servisine ulaşılamadı')
  }
}

/** Süreli bellek önbelleği (tarifeler gün içinde değişmez). */
export class TtlCache<T> {
  private readonly map = new Map<string, { at: number; value: T }>()
  private readonly ttlMs: number
  constructor(ttlMs: number) {
    this.ttlMs = ttlMs
  }

  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.map.get(key)
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value
    const value = await load()
    this.map.set(key, { at: Date.now(), value })
    return value
  }
}
