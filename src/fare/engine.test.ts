import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, simulate, type DistanceQuote, type LegInput } from './engine.ts'
import type { TariffCode } from './tariffs.ts'

const t = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

let n = 0
function leg(tariff: TariffCode, board: string, extra: Partial<LegInput> = {}): LegInput {
  const boardMin = t(board)
  return {
    id: `l${++n}`,
    mode: tariff === 'I' ? 'izban' : 'bus',
    ref: extra.ref ?? String(n),
    tariff,
    repeatKey: extra.repeatKey ?? `k${n}`,
    boardMin,
    alightMin: boardMin + 20,
    ...extra,
  }
}

// Çiğli → Alsancak (17,6 km) gerçek servis yanıtı
const IZBAN_SHORT: DistanceQuote = {
  tam: { price: 40, minBalance: 155.55, refund: 115.55 },
  genc: { price: 16.5, minBalance: 66.58, refund: 50.08 },
  ogretmen: { price: 29.5, minBalance: 79.58, refund: 50.08 },
  yas60: { price: 33.5, minBalance: 91.28, refund: 57.78 },
}
// Aliağa → Selçuk (136,5 km) gerçek servis yanıtı
const IZBAN_LONG: DistanceQuote = {
  tam: { price: 214.8, minBalance: 214.8, refund: 0 },
  genc: { price: 92.25, minBalance: 92.25, refund: 0 },
  ogretmen: { price: 105.25, minBalance: 105.25, refund: 0 },
  yas60: { price: 120.9, minBalance: 120.9, refund: 0 },
}

describe('90 dakika aktarma', () => {
  it('ilk biniş ücretli, 90 dk içindeki sonraki binişler ücretsiz', () => {
    const r = simulate([leg('A', '10:00'), leg('A', '10:30'), leg('A', '11:20')], 'tam')
    expect(r.legs.map((l) => l.charged)).toEqual([35, 0, 0])
    expect(r.legs.map((l) => l.status)).toEqual(['paid', 'transfer', 'transfer'])
    expect(r.total).toBe(35)
    expect(r.saved).toBe(70)
  })

  it('90 dakika dolunca yeni ücret alınır ve yeni süre başlar', () => {
    const r = simulate([leg('A', '10:00'), leg('A', '11:31'), leg('A', '12:00')], 'tam')
    expect(r.legs.map((l) => l.charged)).toEqual([35, 35, 0])
    expect(r.legs[1].window?.openedHere).toBe(true)
    expect(r.legs[2].window?.startMin).toBe(t('11:31'))
  })

  it('tam 90. dakikadaki biniş hâlâ aktarmadır', () => {
    const r = simulate([leg('A', '10:00'), leg('A', '11:30')], 'tam')
    expect(r.legs[1].charged).toBe(0)
  })

  it('kart tipine göre ilk biniş ücreti', () => {
    const legs = [leg('A', '10:00'), leg('A', '10:20')]
    expect(simulate(legs, 'genc').total).toBe(17.5)
    expect(simulate(legs, 'ogretmen').total).toBe(23.5)
    expect(simulate(legs, 'yas60').total).toBe(29)
  })

  it('5 dk koruma süresi dolmadan binişte aktarma verilmez', () => {
    const r = simulate([leg('A', '10:00'), leg('A', '10:03')], 'tam')
    expect(r.legs[1].charged).toBe(35)
    expect(r.legs[1].notes.some((x) => x.text.includes('koruma'))).toBe(true)
  })

  it('30 dk içinde aynı hatta tekrar binişte aktarma verilmez', () => {
    const r = simulate([leg('A', '10:00', { repeatKey: 'bus:35' }), leg('A', '10:20', { repeatKey: 'bus:35' })], 'tam')
    expect(r.legs[1].charged).toBe(35)
  })

  it('aynı hatta 30 dk sonra binişte aktarma geçerlidir', () => {
    const r = simulate([leg('A', '10:00', { repeatKey: 'bus:35' }), leg('A', '10:31', { repeatKey: 'bus:35' })], 'tam')
    expect(r.legs[1].charged).toBe(0)
  })
})

describe('aktarmasız tarifeler', () => {
  it('B/D/F/G tarifeleri her binişte ücretlidir ve aktarma süresini bozmaz', () => {
    const r = simulate([leg('A', '10:00'), leg('D', '10:20'), leg('A', '10:50')], 'tam')
    expect(r.legs.map((l) => l.charged)).toEqual([35, 77.5, 0])
  })

  it('aktarmasız tarife aktarma süresi başlatmaz', () => {
    const r = simulate([leg('G', '10:00'), leg('A', '10:30')], 'tam')
    expect(r.legs.map((l) => l.charged)).toEqual([77, 35])
  })
})

describe('Halk Taşıt', () => {
  it('05–07 ve 19–20 arasında A tarifesi yarı fiyat', () => {
    expect(simulate([leg('A', '06:30')], 'tam').total).toBe(17.5)
    expect(simulate([leg('A', '19:59')], 'ogretmen').total).toBe(11.75)
    expect(simulate([leg('A', '07:00')], 'tam').total).toBe(35)
    expect(simulate([leg('A', '20:00')], 'tam').total).toBe(35)
  })

  it('Havalimanı (G) ve Baykuş (F) tarifesinde indirim yok', () => {
    expect(simulate([leg('G', '06:00')], 'tam').total).toBe(77)
    expect(simulate([leg('F', '19:30')], 'genc').total).toBe(38.5)
  })

  it('D tarifesi Halk Taşıt saatinde yarı fiyat', () => {
    expect(simulate([leg('D', '06:00')], 'tam').total).toBe(38.75)
  })
})

describe('İZBAN', () => {
  it('aktarma kapalıyken her zaman tam mesafe ücreti, blokaj ve iade', () => {
    const settings = { ...DEFAULT_SETTINGS, izbanTransfer: false }
    const r = simulate([leg('A', '10:00'), leg('I', '10:20', { quote: IZBAN_SHORT })], 'tam', settings)
    expect(r.legs[1]).toMatchObject({ status: 'paid', charged: 40, deductedAtBoard: 155.55, refund: 115.55 })
    expect(r.total).toBe(75)
  })

  it('aktarma kapalıyken İZBAN aktarma süresini başlatmaz', () => {
    const settings = { ...DEFAULT_SETTINGS, izbanTransfer: false }
    const r = simulate([leg('I', '10:00', { quote: IZBAN_SHORT }), leg('A', '10:40')], 'tam', settings)
    expect(r.legs.map((l) => l.charged)).toEqual([40, 35])
  })

  it('aktarma açıkken kısa İZBAN yolculuğu: blokaj inişte tamamen iade', () => {
    const r = simulate([leg('A', '10:00'), leg('I', '10:20', { quote: IZBAN_SHORT })], 'tam')
    expect(r.legs[1]).toMatchObject({ status: 'transfer', charged: 0, deductedAtBoard: 155.55, refund: 155.55 })
    expect(r.total).toBe(35)
  })

  it('aktarma açıkken uzun İZBAN yolculuğu: yalnız taban ücreti aşan kısım ödenir', () => {
    const r = simulate([leg('A', '10:00'), leg('I', '10:20', { quote: IZBAN_LONG })], 'tam')
    expect(r.legs[1]).toMatchObject({ status: 'transfer-partial', charged: 174.8, deductedAtBoard: 214.8, refund: 40 })
  })

  it('ilk biniş İZBAN ise tam ücret alınır ve aktarma süresi başlar', () => {
    const r = simulate([leg('I', '10:00', { quote: IZBAN_SHORT }), leg('A', '10:40')], 'genc')
    expect(r.legs.map((l) => l.charged)).toEqual([16.5, 0])
  })

  it('İZBAN Halk Taşıt indiriminden etkilenmez', () => {
    const r = simulate([leg('I', '06:30', { quote: IZBAN_SHORT })], 'tam')
    expect(r.legs[0]).toMatchObject({ charged: 40, halkTasit: false })
  })
})

describe('Genç yerleşke (E) → merkez (A)', () => {
  it('90 dk içinde A tarifesine geçişte aradaki fark tahsil edilir, sonrası ücretsiz', () => {
    const r = simulate([leg('E', '09:00'), leg('A', '09:30'), leg('A', '10:00')], 'genc')
    expect(r.legs.map((l) => l.charged)).toEqual([5, 12.5, 0])
  })

  it('tam kartta yerleşke tarifesi merkezle aynı, aktarma ücretsiz', () => {
    const r = simulate([leg('E', '09:00'), leg('A', '09:30')], 'tam')
    expect(r.legs.map((l) => l.charged)).toEqual([35, 0])
  })
})

describe('mesafe bazlı otobüs ve bakiye', () => {
  it('ücreti henüz bilinmeyen bacak toplamı bekletir', () => {
    const r = simulate([leg('A', '10:00'), leg('C', '10:20')], 'tam')
    expect(r.legs[1].status).toBe('pending')
    expect(r.total).toBeNull()
  })

  it('bakiye takibi: blokaj düşülür, inişte iade eklenir, yetersizlik işaretlenir', () => {
    const r = simulate(
      [leg('A', '10:00'), leg('I', '10:20', { quote: IZBAN_SHORT })],
      'tam',
      { ...DEFAULT_SETTINGS, izbanTransfer: false },
      100,
    )
    expect(r.legs[0]).toMatchObject({ balanceAfterBoard: 65, balanceAfterAlight: 65, insufficient: false })
    expect(r.legs[1]).toMatchObject({ insufficient: true, balanceAfterBoard: -90.55, balanceAfterAlight: 25 })
    expect(r.endBalance).toBe(25)
  })
})
