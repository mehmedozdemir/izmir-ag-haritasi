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

export type FareResult = {
  from: string
  to: string
  km: number
  date: string
  fares: FareItem[]
}
