// ESHOT "Gittiğin Kadar Öde" (mesafe bazlı) otobüs ücret servisinin istemcisi.
// Kaynak sayfa: https://www.eshot.gov.tr/tr/GittiginKadarOde/288
import type { DistanceFareResult } from './fare-types.ts'
import { FareError, TtlCache, fetchUpstream } from './upstream.ts'

const UPSTREAM = 'https://www.eshot.gov.tr/tr/MesafeTutarHesapla'

type UpstreamEshotFare = {
  BinisDurakAdi: string
  InisDurakAdi: string
  MesafeKm: number
  TutarTam: number
  TutarOgrenci: number
  TutarOgretmen: number
  Tutar60Yas: number
  MinBakiyeTam: number
  MinBakiyeOgrenci: number
  MinBakiyeOgretmen: number
  MinBakiye60Yas: number
  IadeTam: number
  IadeOgrenci: number
  IadeOgretmen: number
  Iade60Yas: number
}

const cache = new TtlCache<DistanceFareResult>(12 * 60 * 60 * 1000)

/**
 * @param direction ESHOT yönü: 1 = gidiş (GTFS direction_id 0), 2 = dönüş (GTFS direction_id 1)
 * @param halkTasit Halk Taşıt saatinde mi (ücret yarıya iner)
 */
export async function getEshotFare(
  line: number,
  direction: number,
  fromStop: number,
  toStop: number,
  halkTasit: boolean,
): Promise<DistanceFareResult> {
  if (![line, fromStop, toStop].every((n) => Number.isInteger(n) && n > 0)) throw new FareError(400, 'Geçersiz hat veya durak')
  if (direction !== 1 && direction !== 2) throw new FareError(400, 'Geçersiz yön (1 veya 2)')
  if (fromStop === toStop) throw new FareError(400, 'Biniş ve iniş durağı aynı olamaz')

  const htt = halkTasit ? 1 : 0
  return cache.getOrLoad(`${line}/${direction}/${fromStop}/${toStop}/${htt}`, async () => {
    const raw = (await fetchUpstream(`${UPSTREAM}/${fromStop}/${toStop}/${direction}/${line}/${htt}`)) as UpstreamEshotFare | null
    if (!raw || typeof raw.TutarTam !== 'number') throw new FareError(502, 'ESHOT servisinden beklenmeyen yanıt')
    return {
      from: raw.BinisDurakAdi,
      to: raw.InisDurakAdi,
      km: raw.MesafeKm,
      quote: {
        tam: { price: raw.TutarTam, minBalance: raw.MinBakiyeTam, refund: raw.IadeTam },
        genc: { price: raw.TutarOgrenci, minBalance: raw.MinBakiyeOgrenci, refund: raw.IadeOgrenci },
        ogretmen: { price: raw.TutarOgretmen, minBalance: raw.MinBakiyeOgretmen, refund: raw.IadeOgretmen },
        yas60: { price: raw.Tutar60Yas, minBalance: raw.MinBakiye60Yas, refund: raw.Iade60Yas },
      },
    }
  })
}
