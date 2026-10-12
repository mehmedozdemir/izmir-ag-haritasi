// API sözleşmesi: sunucu ve frontend tarafından ortak kullanılır (Node bağımlılığı içermemeli).

export type FareType = 'tam' | 'ogrenci' | 'ogretmen' | 'yas60' | 'serbest'

export type FareItem = {
  type: FareType
  label: string
  unit: 'TL' | 'kontör'
  price: number
  /** Binişte kartta bulunması (bloke edilmesi) gereken tutar */
  minBalance: number
  /** İnişte iade edilen blokaj tutarı */
  refund: number
}

/** Mesafe bazlı ücret: kart tipi başına ücret, binişte gereken (bloke) bakiye ve inişte iade. */
export type DistanceQuoteItem = { price: number; minBalance: number; refund: number }

export type DistanceFareResult = {
  from: string
  to: string
  km: number
  quote: Record<'tam' | 'genc' | 'ogretmen' | 'yas60', DistanceQuoteItem>
}

export type FareResult = {
  from: string
  to: string
  km: number
  date: string
  fares: FareItem[]
}
