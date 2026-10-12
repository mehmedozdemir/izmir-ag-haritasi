// İzmir Büyükşehir Belediyesi toplu ulaşım fiyat tarifesi (KDV dahil).
// Kaynak: https://izmirimkart.com.tr/tarife-ve-ucretlendirme — 01.04.2026 tarihinden geçerli tarife.
// Tarife değiştiğinde güncellenmesi gereken tek dosya budur.

export const TARIFF_VALID_FROM = '2026-04-01'

export type CardType = 'tam' | 'genc' | 'ogretmen' | 'yas60'

/** Kart tipleri; renkler index.css'teki --card-* değişkenlerinden (açık/koyu temaya göre). */
export const CARD_TYPES: { type: CardType; label: string; color: string }[] = [
  { type: 'tam', label: 'Tam', color: 'var(--card-tam)' },
  { type: 'genc', label: 'Genç', color: 'var(--card-genc)' },
  { type: 'ogretmen', label: 'Öğretmen', color: 'var(--card-ogretmen)' },
  { type: 'yas60', label: '60 Yaş', color: 'var(--card-yas60)' },
]

export const cardMeta = (type: CardType) => CARD_TYPES.find((c) => c.type === type)!

/** Tarife kodları: tarife sayfasındaki (A)…(K) başlıkları. */
export type TariffCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'I' | 'J' | 'K'

type Prices = Record<CardType, number>

export type TariffRule = {
  code: TariffCode
  label: string
  /** Sabit ücret; mesafeye bağlı tarifelerde (C, I, J) yok — ücret servisten gelir. */
  prices?: Prices
  /** Halk Taşıt saatlerinde fiyat yarıya iner mi? */
  halkTasit: boolean
  /** 90 dakika aktarma hakkı var mı? (İZBAN için ayrıca FareSettings.izbanTransfer'e bakılır) */
  transfer: boolean
  /** Ücret mesafeye göre servisten hesaplanır (blokaj + iade). */
  distanceBased?: 'eshot' | 'izban'
}

const MERKEZ: Prices = { tam: 35, genc: 17.5, ogretmen: 23.5, yas60: 29 }

export const TARIFFS: Record<TariffCode, TariffRule> = {
  A: { code: 'A', label: 'Merkez', prices: MERKEZ, halkTasit: true, transfer: true },
  B: { code: 'B', label: 'İlçe (aktarmasız)', prices: MERKEZ, halkTasit: true, transfer: false },
  C: { code: 'C', label: 'Gittiğin Kadar Öde', halkTasit: true, transfer: false, distanceBased: 'eshot' },
  D: { code: 'D', label: 'Uzak İlçe', prices: { tam: 77.5, genc: 39, ogretmen: 52, yas60: 64 }, halkTasit: true, transfer: false },
  E: { code: 'E', label: 'Yerleşke', prices: { tam: 35, genc: 5, ogretmen: 23.5, yas60: 29 }, halkTasit: true, transfer: true },
  F: { code: 'F', label: 'Baykuş (gece)', prices: { tam: 77, genc: 38.5, ogretmen: 52, yas60: 64 }, halkTasit: false, transfer: false },
  G: { code: 'G', label: 'Havalimanı', prices: { tam: 77, genc: 38.5, ogretmen: 52, yas60: 64 }, halkTasit: false, transfer: false },
  I: { code: 'I', label: 'İZBAN (banliyö)', halkTasit: false, transfer: true, distanceBased: 'izban' },
  J: { code: 'J', label: 'İZTAŞIT Uzun Hat', halkTasit: true, transfer: false, distanceBased: 'eshot' },
  K: { code: 'K', label: 'İZTAŞIT Kısa Hat', prices: MERKEZ, halkTasit: true, transfer: true },
}

/** İZBAN (I) ilk 20 km ücreti — aktarmada "ödenmiş sayılan" taban ücret olarak kullanılır. */
export const IZBAN_BASE_FARE: Prices = { tam: 40, genc: 16.5, ogretmen: 29.5, yas60: 33.5 }

// Otobüs hat numarası → tarife. Listede olmayan otobüs hatları (A) merkez tarifesidir.
const BUS_LINES: Partial<Record<TariffCode, number[]>> = {
  B: [
    179, 609, 611, 616, 618, 621, 640, 641, 642, 643, 644, 645, 651, 652, 653, 656, 657, 664, 665, 666, 668, 678, 679, 692,
    693, 694, 701, 707, 709, 710, 712, 713, 714, 715, 719, 721, 722, 724, 729, 732, 733, 734, 737, 738, 744, 745, 747,
    752, 753, 754, 755, 758, 759, 762, 763, 766, 767, 768, 769, 770, 772, 774, 775, 776, 778, 780, 781, 782, 783, 784, 785,
    786, 787, 788, 789, 790, 791, 792, 793, 794, 799, 813, 829, 831, 832, 833, 834, 836, 839, 842, 849, 865, 872, 881, 882,
    961, 962, 967, 976, 979, 989, 990, 991,
  ],
  // 743 tarife sayfasında (B) listesinde, ESHOT "Gittiğin Kadar Öde" hesaplayıcısında da yer alıyor;
  // fiilen mesafe bazlı ücretlendirildiği için (C) kabul edildi.
  C: [
    602, 608, 661, 675, 684, 727, 743, 750, 756, 796, 800, 801, 803, 909, 966, 975, 981, 982, 983, 984, 985, 986, 987, 988,
  ],
  D: [760, 761, 795, 798, 835, 837, 883, 906, 936, 978],
  E: [412],
  F: [910, 920, 930, 940, 950],
  G: [200, 202, 204, 206],
  J: [660, 697, 806, 858],
  K: [128, 619, 648, 658, 695, 698, 748, 749, 757, 812, 826, 848, 850, 868],
}

const busTariffByLine = new Map<number, TariffCode>()
for (const [code, lines] of Object.entries(BUS_LINES) as [TariffCode, number[]][]) {
  for (const n of lines) busTariffByLine.set(n, code)
}

export type Mode = 'bus' | 'metro' | 'tram' | 'izban' | 'ferry'

export function tariffFor(mode: Mode, ref: string): TariffCode {
  if (mode === 'izban') return 'I'
  if (mode !== 'bus') return 'A' // metro, tramvay, vapur
  return busTariffByLine.get(Number.parseInt(ref, 10)) ?? 'A'
}

/** Halk Taşıt saatleri: 05:00–07:00 ve 19:00–20:00 (bitiş hariç). */
export function isHalkTasit(minutesOfDay: number): boolean {
  return (minutesOfDay >= 5 * 60 && minutesOfDay < 7 * 60) || (minutesOfDay >= 19 * 60 && minutesOfDay < 20 * 60)
}

/** Yarıya bölünemeyen tutar kuruş bazında bir üste yuvarlanır. */
export const halve = (n: number) => Math.ceil(n * 50) / 100
