// Yolculuk ücret simülasyonu: sıralı binişler için kart tipine göre kesinti, blokaj, iade ve aktarma hesabı.
// Saf fonksiyonlardan oluşur; mesafe bazlı ücretler (İZBAN, Gittiğin Kadar Öde) önceden alınmış "quote" olarak gelir.
//
// Uygulanan kurallar (izmirimkart.com.tr "Aktarmalı Ulaşım Kuralları"):
//  - Aktarma hakkı olan tarifelerde ilk ücretli binişle 90 dk'lık aktarma süresi başlar; bu sürede sonraki binişler ücretsizdir.
//  - Her biniş arasında 5 dk koruma süresi vardır; dolmadan yapılan binişte aktarma verilmez, tam ücret alınır.
//  - 30 dk içinde aynı otobüs hattına / aynı istasyon-iskeleye tekrar binişte aktarma verilmez.
//  - Halk Taşıt saatlerinde (05–07, 19–20) ilgili tarifelerde ücret yarıdır.
//  - Genç kart: (E) Yerleşke tarifesinden 90 dk içinde (A)/(K) tarifesine geçişte aradaki fark tahsil edilir.
// Varsayımlar (belgede net değil, FareSettings ile ayarlanabilir):
//  - Aktarma hakkı olmayan tarifeler (B, C, D, F, G, J ve kapalıysa İZBAN) aktarma süresini ne başlatır ne bozar.
//  - İZBAN aktarması (15.10.2026 itibarıyla): açık aktarma süresinde İZBAN'a binişte blokaj alınır; inişte
//    İZBAN taban ücreti (ilk 20 km) ödenmiş sayılır, yalnızca aşan kısım tahsil edilip kalan blokaj iade edilir.

import { IZBAN_BASE_FARE, TARIFFS, halve, isHalkTasit, type CardType, type Mode, type TariffCode } from './tariffs.ts'

export type FareSettings = {
  /** İZBAN 90 dk aktarma sistemine dahil mi? */
  izbanTransfer: boolean
  transferWindowMin: number
  protectionMin: number
  sameVehicleMin: number
}

export const DEFAULT_SETTINGS: FareSettings = {
  izbanTransfer: true,
  transferWindowMin: 90,
  protectionMin: 5,
  sameVehicleMin: 30,
}

/** Mesafe bazlı servisten gelen tek kart tipi ücreti. */
export type QuoteItem = { price: number; minBalance: number; refund: number }
export type DistanceQuote = Record<CardType, QuoteItem>

export type LegInput = {
  id: string
  mode: Mode
  ref: string
  tariff: TariffCode
  /** 30 dk tekrar-biniş kuralı için kimlik: otobüste hat, raylı/vapurda biniş istasyonu. */
  repeatKey: string
  /** Gün başından itibaren dakika (gece yarısını geçen yolculukta 1440'ı aşabilir). */
  boardMin: number
  alightMin: number
  /** Mesafe bazlı tarifelerde zorunlu; yoksa bacak "bekliyor" durumunda kalır. */
  quote?: DistanceQuote
}

export type LegStatus = 'paid' | 'transfer' | 'transfer-partial' | 'pending'

export type Note = { tone: 'info' | 'good' | 'warn'; text: string }

export type LegResult = {
  legId: string
  status: LegStatus
  /** Bu binişin net maliyeti (blokaj − iade). */
  charged: number
  /** Binişte karttan düşülen tutar (mesafe bazlıda blokaj, diğerlerinde ücret). */
  deductedAtBoard: number
  /** İnişte iade edilen tutar. */
  refund: number
  /** İndirimsiz (aktarmasız) olsaydı ödenecek ücret. */
  fullFare: number
  halkTasit: boolean
  /** Biniş anındaki aktarma süresi durumu. */
  window: { startMin: number; endMin: number; openedHere: boolean } | null
  notes: Note[]
  balanceAfterBoard?: number
  balanceAfterAlight?: number
  insufficient?: boolean
}

export type SimulationResult = {
  card: CardType
  legs: LegResult[]
  /** Toplam net ödeme; bekleyen (ücreti henüz bilinmeyen) bacak varsa null. */
  total: number | null
  /** Aktarmasız senaryoya göre tasarruf. */
  saved: number | null
  endBalance?: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

type TransferWindow = { startMin: number; payerTariff: TariffCode; paidFare: number }

export function simulate(
  legs: LegInput[],
  card: CardType,
  settings: FareSettings = DEFAULT_SETTINGS,
  startBalance?: number,
): SimulationResult {
  let active: TransferWindow | null = null
  let lastBoard: number | null = null
  const history: { key: string; min: number }[] = []
  let balance = startBalance
  const results: LegResult[] = []

  for (const leg of legs) {
    const rule = TARIFFS[leg.tariff]
    const notes: Note[] = []
    const htt = rule.halkTasit && isHalkTasit(((leg.boardMin % 1440) + 1440) % 1440)
    const eligible = rule.transfer && (leg.tariff !== 'I' || settings.izbanTransfer)

    // Tam (aktarmasız) ücret ve blokaj.
    let fullFare: number
    let blocked: number | null = null // yalnızca mesafe bazlı
    let quoteRefund = 0
    if (rule.distanceBased) {
      const q = leg.quote?.[card]
      if (!q) {
        results.push({
          legId: leg.id, status: 'pending', charged: NaN, deductedAtBoard: NaN, refund: NaN, fullFare: NaN,
          halkTasit: htt, window: null, notes: [{ tone: 'info', text: 'Mesafe bazlı ücret bekleniyor' }],
        })
        lastBoard = leg.boardMin
        history.push({ key: leg.repeatKey, min: leg.boardMin })
        continue
      }
      fullFare = q.price
      blocked = q.minBalance
      quoteRefund = q.refund
    } else {
      fullFare = rule.prices![card]
      if (htt) fullFare = halve(fullFare)
    }

    const inWindow = active !== null && leg.boardMin - active.startMin <= settings.transferWindowMin
    const protection = lastBoard !== null && leg.boardMin - lastBoard < settings.protectionMin
    const repeat = history.some((h) => h.key === leg.repeatKey && leg.boardMin - h.min < settings.sameVehicleMin)
    const transferApplies = eligible && inWindow && !protection && !repeat

    let charged = fullFare
    let status: LegStatus = 'paid'
    let openedHere = false

    if (transferApplies && active) {
      if (leg.tariff === 'I') {
        // İZBAN aktarması: taban ücret ödenmiş sayılır, aşan mesafe ücreti tahsil edilir.
        charged = Math.max(0, round2(fullFare - IZBAN_BASE_FARE[card]))
        status = charged > 0 ? 'transfer-partial' : 'transfer'
        notes.push(
          charged > 0
            ? { tone: 'good', text: `Aktarma: ilk 20 km ücreti (${tl(IZBAN_BASE_FARE[card])}) düşüldü, aşan mesafe tahsil edildi` }
            : { tone: 'good', text: 'Aktarma: İZBAN yolculuğu taban mesafe içinde, blokaj inişte tamamen iade' },
        )
      } else if (card === 'genc' && active.payerTariff === 'E' && leg.tariff !== 'E') {
        charged = Math.max(0, round2(fullFare - active.paidFare))
        status = charged > 0 ? 'transfer-partial' : 'transfer'
        notes.push({ tone: 'good', text: 'Yerleşke tarifesinden aktarma: aradaki fark tahsil edildi' })
        active.payerTariff = leg.tariff
        active.paidFare = fullFare
      } else {
        charged = 0
        status = 'transfer'
        notes.push({ tone: 'good', text: 'Aktarma: 90 dk içinde ücretsiz' })
      }
    } else {
      if (!rule.transfer) notes.push({ tone: 'info', text: `${rule.label} tarifesinde aktarma hakkı yok` })
      else if (leg.tariff === 'I' && !settings.izbanTransfer) notes.push({ tone: 'info', text: 'İZBAN aktarması kapalı' })
      if (eligible && inWindow && protection) {
        notes.push({ tone: 'warn', text: `${settings.protectionMin} dk koruma süresi dolmadan biniş: aktarma verilmedi` })
      }
      if (eligible && inWindow && repeat) {
        notes.push({ tone: 'warn', text: `${settings.sameVehicleMin} dk içinde aynı hat/istasyon: aktarma verilmedi` })
      }
      if (eligible && !inWindow) {
        openedHere = true
        if (active) notes.push({ tone: 'info', text: `${settings.transferWindowMin} dk doldu, yeni aktarma süresi başladı` })
        active = { startMin: leg.boardMin, payerTariff: leg.tariff, paidFare: fullFare }
      }
    }
    if (htt) notes.push({ tone: 'good', text: 'Halk Taşıt saati: %50 indirimli' })

    // Mesafe bazlıda binişte blokaj düşülür, inişte iade edilir. Ücretli binişte servisin iade değeri esastır;
    // aktarmada iade, blokajdan tahsil edilen tutar çıkarılarak bulunur.
    const deductedAtBoard = blocked ?? charged
    const refund = blocked === null ? 0 : status === 'paid' ? quoteRefund : round2(blocked - charged)
    if (blocked !== null) charged = round2(blocked - refund)

    const result: LegResult = {
      legId: leg.id,
      status,
      charged: round2(charged),
      deductedAtBoard: round2(deductedAtBoard),
      refund,
      fullFare: round2(fullFare),
      halkTasit: htt,
      window: active && (eligible || inWindow)
        ? { startMin: active.startMin, endMin: active.startMin + settings.transferWindowMin, openedHere }
        : null,
      notes,
    }

    if (balance !== undefined) {
      result.insufficient = balance < deductedAtBoard
      if (result.insufficient) notes.push({ tone: 'warn', text: 'Bakiye yetersiz: bu biniş için kartta yeterli tutar yok' })
      balance = round2(balance - deductedAtBoard)
      result.balanceAfterBoard = balance
      balance = round2(balance + result.refund)
      result.balanceAfterAlight = balance
    }

    results.push(result)
    lastBoard = leg.boardMin
    history.push({ key: leg.repeatKey, min: leg.boardMin })
  }

  const pending = results.some((r) => r.status === 'pending')
  const total = pending ? null : round2(results.reduce((s, r) => s + r.charged, 0))
  const full = pending ? null : round2(results.reduce((s, r) => s + r.fullFare, 0))
  return { card, legs: results, total, saved: total !== null && full !== null ? round2(full - total) : null, endBalance: balance }
}

function tl(n: number) {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
}
